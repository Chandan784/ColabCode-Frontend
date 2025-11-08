"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  FiPlay,
  FiUsers,
  FiCopy,
  FiLogOut,
  FiX,
  FiTerminal,
  FiUser,
} from "react-icons/fi";
import { auth, googleProvider } from "../lib/firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { io } from "socket.io-client";

function getRandomColor(seed) {
  const colors = [
    "#FF6633",
    "#FFB399",
    "#FF33FF",
    "#FFFF99",
    "#00B3E6",
    "#E6B333",
    "#3366E6",
    "#999966",
    "#99FF99",
    "#B34D4D",
  ];
  let hash = 0;
  for (let i = 0; i < (seed || "").length; i++) {
    hash = (hash << 5) - hash + (seed || "").charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="p-4">Loading editor...</div>,
});

export default function Editor() {
  const [code, setCode] = useState("// Start coding here...");
  const [output, setOutput] = useState("");
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [users, setUsers] = useState([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [cursorPositions, setCursorPositions] = useState({});
  // Add this state at the top of your component
  const [editorKey, setEditorKey] = useState(0);

  // Add this function to refresh the editor
  const refreshEditor = () => {
    setEditorKey((prev) => prev + 1); // This will force a complete remount
    editorRef.current = null; // Clear the editor reference
  };

  const socketRef = useRef(null);
  const editorRef = useRef(null);
  const outputEndRef = useRef(null);
  const typingTimeout = useRef(null);
  const cursorPositionTimeout = useRef(null);

  // Scroll to bottom of output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  // Handle cursor decorations
  useEffect(() => {
    if (!editorRef.current || !window.monaco) return;

    const decorations = Object.entries(cursorPositions).map(
      ([userId, data]) => {
        return {
          range: new monaco.Range(
            data.position.lineNumber,
            data.position.column,
            data.position.lineNumber,
            data.position.column + 1
          ),
          options: {
            className: `remote-cursor-${userId}`,
            glyphMarginClassName: `remote-cursor-margin-${userId}`,
            stickiness:
              monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            hoverMessage: {
              value: `**${data.name}** (${data.position.lineNumber}:${data.position.column})`,
              isTrusted: true,
              supportThemeIcons: true,
            },
          },
        };
      }
    );

    const decorationIds = editorRef.current.deltaDecorations([], decorations);

    const styleElement =
      document.getElementById("remote-cursor-styles") ||
      document.createElement("style");
    styleElement.id = "remote-cursor-styles";

    let styles = "";
    Object.entries(cursorPositions).forEach(([userId, data]) => {
      const color = data.color || getRandomColor(userId);
      styles += `
        .monaco-editor .remote-cursor-${userId} {
          background-color: ${color}20;
          border-left: 2px solid ${color};
          margin-left: -1px;
          height: 18px !important;
          position: relative;
          z-index: 5;
        }
        .monaco-editor .remote-cursor-${userId}::before {
          content: "${data.name}";
          position: absolute;
          top: -20px;
          left: -2px;
          background: ${color};
          color: white;
          font-size: 10px;
          font-family: var(--font-mono);
          padding: 1px 4px;
          border-radius: 3px;
          white-space: nowrap;
          z-index: 10;
          pointer-events: none;
          font-weight: bold;
        }
        .monaco-editor .remote-cursor-margin-${userId} {
          background-color: ${color} !important;
          width: 3px !important;
        }
      `;
    });

    styleElement.innerHTML = styles;
    if (!document.getElementById("remote-cursor-styles")) {
      document.head.appendChild(styleElement);
    }

    return () => {
      editorRef.current.deltaDecorations(decorationIds, []);
    };
  }, [cursorPositions]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      if (user) connectSocket();
    });
    return unsubscribe;
  }, []);

  // Socket connection
  const connectSocket = () => {
    const socket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5006",
      {
        auth: {
          uid: auth.currentUser?.uid,
          name: auth.currentUser?.displayName,
          photoURL: auth.currentUser?.photoURL,
          email: auth.currentUser?.email,
        },
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      }
    );

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setOutput(
        (prev) =>
          `${prev}${new Date().toLocaleTimeString()} [system] Connected to server\n`
      );

      // Resend cursor position and typing state on reconnect
      if (editorRef.current && roomId && user) {
        const position = editorRef.current.getPosition();
        if (position) {
          socket.emit("cursor-position", {
            roomId,
            position: {
              lineNumber: position.lineNumber,
              column: position.column,
            },
            userId: user.uid,
            name: user.displayName,
          });
        }

        if (typingTimeout.current) {
          socket.emit("user-typing", {
            roomId,
            userId: user.uid,
            name: user.displayName,
          });
        }
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      setOutput(
        (prev) =>
          `${prev}${new Date().toLocaleTimeString()} [system] Disconnected from server\n`
      );
    });

    socket.on("room-data", ({ code, users: roomUsers }) => {
      setCode(code);
      setUsers(roomUsers);
    });

    socket.on("user-list", (userList) => {
      setUsers(userList);
    });

    socket.on("code-update", (newCode) => {
      setCode(newCode);
    });

    socket.on("user-typing", (data) => {
      setTypingUsers((prev) => ({ ...prev, [data.userId]: data }));
    });

    socket.on("user-stopped-typing", (userId) => {
      setTypingUsers((prev) => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    });

    socket.on("cursor-position", (data) => {
      setCursorPositions((prev) => ({
        ...prev,
        [data.userId]: {
          ...data,
          color: getRandomColor(data.userId),
          name: data.name || "Anonymous",
        },
      }));
    });

    socket.on("connect_error", (err) => {
      setOutput(
        (prev) =>
          `${prev}${new Date().toLocaleTimeString()} [error] Connection error: ${
            err.message
          }\n`
      );
    });

    return () => {
      socket.disconnect();
    };
  };

  // Auth functions
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setOutput(
        (prev) =>
          `${prev}${new Date().toLocaleTimeString()} [system] Signed in as ${
            auth.currentUser?.displayName
          }\n`
      );
    } catch (error) {
      setOutput(
        (prev) =>
          `${prev}${new Date().toLocaleTimeString()} [error] Login failed: ${
            error.message
          }\n`
      );
    }
  };

  const handleLogout = async () => {
    try {
      if (socketRef.current) {
        if (roomId) {
          socketRef.current.emit("leave-room", roomId);
        }
        socketRef.current.disconnect();
      }
      await signOut(auth);
      setRoomId("");
      setShowProfileModal(false);
      setUsers([]);
      setOutput(
        (prev) =>
          `${prev}${new Date().toLocaleTimeString()} [system] Signed out\n`
      );
    } catch (error) {
      setOutput(
        (prev) =>
          `${prev}${new Date().toLocaleTimeString()} [error] Logout failed: ${
            error.message
          }\n`
      );
    }
  };

  // Room functions
  const handleCreateRoom = () => {
    if (!user) return setShowRoomModal(false);
    socketRef.current.emit("create-room", (response) => {
      if (response.error) {
        setOutput(
          (prev) =>
            `${prev}${new Date().toLocaleTimeString()} [error] ${
              response.error
            }\n`
        );
      } else {
        refreshEditor();

        setRoomId(response.roomId);
        setShowRoomModal(false);
        setOutput(
          (prev) =>
            `${prev}${new Date().toLocaleTimeString()} [room] Created room ${
              response.roomId
            }\n`
        );
      }
    });
  };
  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) return;
    socketRef.current.emit("join-room", joinRoomId.trim(), (response) => {
      if (response.error) {
        setOutput(
          (prev) =>
            `${prev}${new Date().toLocaleTimeString()} [error] ${
              response.error
            }\n`
        );
      } else {
        refreshEditor(); // <-- ADD THIS LINE RIGHT HERE
        setRoomId(joinRoomId.trim());
        setShowRoomModal(false);
        setOutput(
          (prev) =>
            `${prev}${new Date().toLocaleTimeString()} [room] Joined room ${joinRoomId.trim()}\n`
        );
      }
    });
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`);
    setOutput(
      (prev) =>
        `${prev}${new Date().toLocaleTimeString()} [system] Room link copied\n`
    );
  };

  // Code execution
  const runCode = async () => {
    setIsRunning(true);
    setOutput(
      (prev) =>
        `${prev}${new Date().toLocaleTimeString()} [exec] Running code...\n`
    );

    const originalConsole = { ...console };
    const originalFetch = window.fetch;
    let outputBuffer = "";

    const updateOutput = (message) => {
      outputBuffer += message;
      setOutput((prev) => prev + message);
    };

    console.log = (...args) => {
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");
      updateOutput(`${new Date().toLocaleTimeString()} [log] ${message}\n`);
      originalConsole.log(...args);
    };

    console.error = (...args) => {
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");
      updateOutput(`${new Date().toLocaleTimeString()} [error] ${message}\n`);
      originalConsole.error(...args);
    };

    window.fetch = async (...args) => {
      const url = args[0] instanceof Request ? args[0].url : args[0];
      updateOutput(
        `${new Date().toLocaleTimeString()} [fetch] Request to ${url}\n`
      );
      try {
        const response = await originalFetch(...args);
        const data = await response
          .clone()
          .json()
          .catch(() => null);
        updateOutput(
          `${new Date().toLocaleTimeString()} [fetch] Response: ${
            response.status
          }\n`
        );
        if (data) updateOutput(`${JSON.stringify(data, null, 2)}\n`);
        return response;
      } catch (error) {
        updateOutput(
          `${new Date().toLocaleTimeString()} [fetch] Error: ${error.message}\n`
        );
        throw error;
      }
    };

    try {
      const AsyncFunction = Object.getPrototypeOf(
        async function () {}
      ).constructor;
      const fn = new AsyncFunction(code);
      await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Execution timed out (10s)")),
            10000
          )
        ),
      ]);
    } catch (error) {
      updateOutput(
        `${new Date().toLocaleTimeString()} [error] ${error.message}\n`
      );
    } finally {
      window.fetch = originalFetch;
      Object.assign(console, originalConsole);
      setIsRunning(false);
    }
  };

  const clearOutput = () => setOutput("");

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <nav className="bg-indigo-600 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">CollabEditor</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={runCode}
              disabled={isRunning || !isConnected}
              className={`flex items-center space-x-1 px-3 py-2 rounded ${
                isRunning
                  ? "bg-gray-500"
                  : !isConnected
                  ? "bg-gray-400"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              <FiPlay className={isRunning ? "animate-pulse" : ""} />
              <span>{isRunning ? "Running..." : "Run Code"}</span>
            </button>
            <button
              onClick={() => setShowRoomModal(true)}
              className="flex items-center space-x-1 bg-indigo-700 hover:bg-indigo-800 px-3 py-2 rounded"
            >
              <FiUsers />
              <span>Room</span>
              {roomId && (
                <span className="ml-1 text-xs bg-indigo-900 px-1.5 py-0.5 rounded-full">
                  {users.length}
                </span>
              )}
            </button>
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileModal(!showProfileModal)}
                  className="flex items-center space-x-2 group"
                >
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    className="w-8 h-8 rounded-full border-2 border-white group-hover:border-indigo-300"
                  />
                  <span className="hidden md:inline text-sm">
                    {user.displayName}
                  </span>
                </button>
                {showProfileModal && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <div className="px-4 py-3 border-b">
                      <p className="text-gray-800 font-medium truncate">
                        {user.displayName}
                      </p>
                      <p className="text-gray-600 text-sm truncate">
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-gray-800 hover:bg-gray-100"
                    >
                      <FiLogOut className="mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="bg-white text-indigo-600 hover:bg-gray-100 px-4 py-2 rounded font-medium flex items-center"
              >
                <FiUser className="mr-2" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-grow flex w-full">
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="bg-indigo-600 text-white p-3 flex justify-between items-center">
            <h3 className="font-medium flex items-center">
              <FiUsers className="mr-2" />
              Active Users ({users.length})
            </h3>
            {roomId && (
              <button
                onClick={copyRoomLink}
                className="text-xs bg-indigo-700 hover:bg-indigo-800 p-1 rounded"
                title="Copy room link"
              >
                <FiCopy size={14} />
              </button>
            )}
          </div>
          <div className="flex-grow p-3 overflow-y-auto">
            {users.length > 0 ? (
              <ul className="space-y-3">
                {users.map((user) => (
                  <li key={user.uid} className="flex items-center space-x-3">
                    <img
                      src={user.photoURL}
                      alt={user.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="min-w-0">
                      <p className="text-gray-800 truncate">{user.name}</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        {typingUsers[user.uid] && (
                          <div className="flex items-center">
                            <span className="relative flex h-2 w-2 mr-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                            </span>
                            <span className="text-yellow-600">Typing</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-center py-4">No active users</p>
            )}
          </div>
        </div>

        <div className="flex-grow bg-white">
          <MonacoEditor
            key={`monaco-editor-${editorKey}`} // This forces fresh initialization
            height="100%"
            language="javascript"
            value={code}
            onChange={(value) => {
              setCode(value || "");
              if (roomId && socketRef.current) {
                socketRef.current.emit("code-change", {
                  roomId,
                  code: value,
                });
              }
            }}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monaco.editor.setTheme("vs-dark");
              // Send initial cursor position
              const position = editor.getPosition();
              if (position && roomId && socketRef.current && user) {
                socketRef.current.emit("cursor-position", {
                  roomId,
                  position: {
                    lineNumber: position.lineNumber,
                    column: position.column,
                  },
                  userId: user.uid,
                  name: user.displayName,
                });
              }

              editor.onDidChangeCursorPosition((e) => {
                if (roomId && socketRef.current && user) {
                  clearTimeout(cursorPositionTimeout.current);
                  cursorPositionTimeout.current = setTimeout(() => {
                    socketRef.current.emit("cursor-position", {
                      roomId,
                      position: {
                        lineNumber: e.position.lineNumber,
                        column: e.position.column,
                      },
                      userId: user.uid,
                      name: user.displayName,
                    });
                  }, 100);
                }
              });

              editor.onDidChangeModelContent(() => {
                if (roomId && socketRef.current && user) {
                  if (!typingTimeout.current) {
                    socketRef.current.emit("user-typing", {
                      roomId,
                      userId: user.uid,
                      name: user.displayName,
                    });
                  }

                  clearTimeout(typingTimeout.current);
                  typingTimeout.current = setTimeout(() => {
                    socketRef.current.emit("user-stopped-typing", {
                      roomId,
                      userId: user.uid,
                    });
                    typingTimeout.current = null;
                  }, 1000);
                }
              });
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: "on",
              automaticLayout: true,
              scrollBeyondLastLine: false,
              renderWhitespace: "selection",
              padding: { top: 10 },
            }}
          />
        </div>

        <div className="w-80 border-l border-gray-200 flex flex-col">
          <div className="bg-gray-800 text-white p-3 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <FiTerminal />
              <h3 className="font-mono font-medium">Terminal</h3>
            </div>
            <button
              onClick={clearOutput}
              className="text-gray-300 hover:text-white"
              title="Clear terminal"
            >
              <FiX size={16} />
            </button>
          </div>

          <div className="bg-gray-700 text-white p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Users</span>
              <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                {users.length} online
              </span>
            </div>
            <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
              {users.map((user) => (
                <div key={user.uid} className="flex items-center space-x-2">
                  <img
                    src={user.photoURL}
                    alt={user.name}
                    className="w-5 h-5 rounded-full"
                  />
                  <span className="text-xs truncate">
                    {user.name}
                    {typingUsers[user.uid] && (
                      <span className="ml-1 text-yellow-400">(typing...)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-grow bg-gray-900 p-4 overflow-auto font-mono text-sm">
            <pre className="whitespace-pre-wrap text-gray-100">
              {output || "// Output will appear here..."}
              <div ref={outputEndRef} />
            </pre>
          </div>
        </div>
      </main>

      {showRoomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Room Management
                </h2>
                <button
                  onClick={() => setShowRoomModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX size={24} />
                </button>
              </div>

              {!user ? (
                <div className="text-center py-8">
                  <p className="mb-4 text-gray-600">
                    Please sign in to create or join rooms
                  </p>
                  <button
                    onClick={handleLogin}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 flex items-center mx-auto"
                  >
                    <FiUser className="mr-2" />
                    Sign In with Google
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">
                      Create New Room
                    </h3>
                    <button
                      onClick={handleCreateRoom}
                      className="w-full bg-indigo-600 text-white py-2.5 rounded hover:bg-indigo-700 flex items-center justify-center"
                    >
                      <FiUsers className="mr-2" />
                      Create Room
                    </button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-2 bg-white text-sm text-gray-500">
                        or
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">
                      Join Existing Room
                    </h3>
                    <div className="flex rounded-md shadow-sm">
                      <input
                        type="text"
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value)}
                        placeholder="Enter Room ID"
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <button
                        onClick={handleJoinRoom}
                        disabled={!joinRoomId.trim()}
                        className={`px-4 py-2 border border-l-0 rounded-r-md ${
                          !joinRoomId.trim()
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                      >
                        Join
                      </button>
                    </div>
                  </div>

                  {roomId && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Share this room
                      </h4>
                      <div className="flex rounded-md shadow-sm">
                        <input
                          type="text"
                          readOnly
                          value={`${window.location.origin}?room=${roomId}`}
                          className="flex-grow px-3 py-2 text-sm border border-gray-300 rounded-l-md bg-gray-100 truncate"
                        />
                        <button
                          onClick={copyRoomLink}
                          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 border border-l-0 rounded-r-md flex items-center"
                        >
                          <FiCopy size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
