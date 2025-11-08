"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { io } from "socket.io-client";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900">
      <p className="text-gray-500 dark:text-gray-400">Loading editor...</p>
    </div>
  ),
});

export default function Editor({
  code,
  onCodeChange,
  roomId,
  user,
  onRoomCreated,
  onRoomJoined,
  onJoinError,
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const socketRef = useRef(null);
  const decorationsRef = useRef({});
  const typingDecorationsRef = useRef({});
  const styleElementsRef = useRef({});
  const typingTimeoutRef = useRef(null);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [users, setUsers] = useState([]);
  const [ownerId, setOwnerId] = useState("");

  // Generate consistent color for each user
  const userColors = useMemo(() => {
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
    return Object.keys(remoteCursors).reduce((acc, userId) => {
      const hash = Array.from(userId).reduce(
        (acc, char) => (acc << 5) - acc + char.charCodeAt(0),
        0
      );
      acc[userId] = colors[Math.abs(hash) % colors.length];
      return acc;
    }, {});
  }, [remoteCursors]);

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    const socket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000",
      {
        auth: {
          uid: user.uid,
          name: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
        },
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 3000,
      }
    );

    socketRef.current = socket;

    const handleConnect = () => {
      setConnectionStatus("connected");
      if (roomId) {
        socket.emit("join-room", roomId, (response) => {
          if (response?.error) {
            onJoinError?.(response.error);
          } else {
            setUsers(response.users);
            setOwnerId(response.ownerId);
            onRoomJoined?.(response);
          }
        });
      }
    };

    const handleDisconnect = () => {
      setConnectionStatus("disconnected");
    };

    const handleRoomData = ({ users, ownerId }) => {
      setUsers(users);
      setOwnerId(ownerId);
    };

    const handleUserJoined = (userData) => {
      setUsers((prev) => [
        ...prev.filter((u) => u.uid !== userData.uid),
        userData,
      ]);
    };

    const handleUserLeft = (userId) => {
      setUsers((prev) => prev.filter((user) => user.uid !== userId));
      setRemoteCursors((prev) => {
        const { [userId]: _, ...rest } = prev;
        return rest;
      });
      setTypingUsers((prev) => {
        const { [userId]: _, ...rest } = prev;
        return rest;
      });
    };

    const handleCursorPosition = ({
      userId,
      name,
      photoURL,
      position,
      isTyping,
    }) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          position,
          name,
          photoURL,
          isTyping,
          color: userColors[userId] || getRandomColor(userId),
        },
      }));

      if (isTyping) {
        setTypingUsers((prev) => ({
          ...prev,
          [userId]: { name, photoURL },
        }));
      } else {
        setTypingUsers((prev) => {
          const { [userId]: _, ...rest } = prev;
          return rest;
        });
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room-data", handleRoomData);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);
    socket.on("remote-cursor-position", handleCursorPosition);
    socket.on("code-update", onCodeChange);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room-data", handleRoomData);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
      socket.off("remote-cursor-position", handleCursorPosition);
      socket.off("code-update", onCodeChange);
      socket.disconnect();
    };
  }, [user, roomId, onRoomJoined, onJoinError, onCodeChange, userColors]);

  const createRoom = () => {
    if (!socketRef.current) return;

    socketRef.current.emit("create-room", (response) => {
      if (response?.roomId) {
        onRoomCreated?.(response);
      }
    });
  };

  const joinRoom = (roomId) => {
    if (!socketRef.current) return;
    socketRef.current.emit("join-room", roomId, (response) => {
      if (response?.error) {
        onJoinError?.(response.error);
      } else {
        onRoomJoined?.(response);
      }
    });
  };

  const updateCursorPosition = (position) => {
    if (!roomId || !socketRef.current || !user) return;
    socketRef.current.emit("cursor-position", {
      roomId,
      position,
    });
  };

  const notifyTyping = () => {
    if (!roomId || !socketRef.current?.connected || !editorRef.current) return;

    const position = editorRef.current.getPosition();
    socketRef.current.emit("user-typing", {
      roomId,
      position,
    });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit("user-stopped-typing", {
        roomId,
      });
    }, 1500);
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme("collab-theme", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#1e1e1e",
        "editorCursor.foreground": userColors[user?.uid] || "#FFFFFF",
      },
    });
    monaco.editor.setTheme("collab-theme");

    editor.onDidChangeModelContent(() => {
      const position = editor.getPosition();
      updateCursorPosition(position);
      notifyTyping();
    });

    editor.onDidChangeCursorPosition((e) => {
      updateCursorPosition(e.position);
      notifyTyping();
    });
  };

  // Render cursors and typing indicators
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Cleanup previous decorations
    Object.values(decorationsRef.current).forEach((decoration) => {
      editor.removeDecorations([decoration]);
    });
    Object.values(typingDecorationsRef.current).forEach((decoration) => {
      editor.removeDecorations([decoration]);
    });
    Object.values(styleElementsRef.current).forEach((style) => {
      if (style.parentNode) document.head.removeChild(style);
    });

    decorationsRef.current = {};
    typingDecorationsRef.current = {};
    styleElementsRef.current = {};

    Object.entries(remoteCursors).forEach(([userId, cursor]) => {
      if (!cursor.position) return;

      const { position, name, photoURL, color, isTyping } = cursor;
      const cursorClass = `cursor-${userId}`;
      const typingClass = `typing-${userId}`;

      // Add cursor decoration
      const cursorDecoration = editor.deltaDecorations(
        [],
        [
          {
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column + 1
            ),
            options: {
              className: cursorClass,
              glyphMarginClassName: cursorClass,
              stickiness:
                monaco.editor.TrackedRangeStickiness
                  .NeverGrowsWhenTypingAtEdges,
              hoverMessage: {
                value: `**${name}**${isTyping ? " (typing...)" : ""}`,
                isTrusted: true,
              },
            },
          },
        ]
      );

      decorationsRef.current[userId] = cursorDecoration[0];

      // Add typing indicator
      if (isTyping) {
        const typingDecoration = editor.deltaDecorations(
          [],
          [
            {
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column + 1
              ),
              options: {
                glyphMarginClassName: typingClass,
                stickiness:
                  monaco.editor.TrackedRangeStickiness
                    .NeverGrowsWhenTypingAtEdges,
              },
            },
          ]
        );
        typingDecorationsRef.current[userId] = typingDecoration[0];
      }

      // Create styles
      const style = document.createElement("style");
      style.innerHTML = `
        .${cursorClass} {
          background-color: ${color} !important;
          width: 2px !important;
          position: relative;
          z-index: 5;
        }
        .${typingClass} {
          background-color: ${color} !important;
          width: 10px !important;
          height: 10px !important;
          border-radius: 50%;
          position: absolute;
          top: -15px;
          left: 0;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      styleElementsRef.current[userId] = style;
    });

    return () => {
      Object.values(decorationsRef.current).forEach((decoration) => {
        editor.removeDecorations([decoration]);
      });
      Object.values(typingDecorationsRef.current).forEach((decoration) => {
        editor.removeDecorations([decoration]);
      });
      Object.values(styleElementsRef.current).forEach((style) => {
        if (style.parentNode) document.head.removeChild(style);
      });
    };
  }, [remoteCursors]);

  return (
    <div className="flex-grow h-full bg-white dark:bg-gray-900 relative">
      <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white p-2 text-xs z-10 rounded">
        {roomId ? `Room: ${roomId}` : "Not in a room"} | Status:{" "}
        {connectionStatus} | Users: {users.length} |
        {user?.displayName || "Anonymous"}
      </div>

      <MonacoEditor
        height="100%"
        language="javascript"
        theme="collab-theme"
        value={code}
        onChange={onCodeChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          automaticLayout: true,
          cursorStyle: "line-thin",
          cursorBlinking: "phase",
          renderLineHighlight: "none",
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          glyphMargin: true,
        }}
      />
    </div>
  );
}

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
