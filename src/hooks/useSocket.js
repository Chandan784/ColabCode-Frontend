import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

export const useSocket = (user) => {
  const [state, setState] = useState({
    roomId: "",
    users: [],
    code: "// Start coding here...",
    output: "",
    isConnected: false,
    isRunning: false,
    isJoining: false,
    joinError: "",
    ownerId: "",
    cursors: {},
    typingUsers: {},
    connectionDuration: 0,
  });
  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const connectionTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(false);
  const pendingRejoinRef = useRef(null);

  // Helper functions
  const updateState = useCallback((updates) => {
    if (isMountedRef.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  const appendOutput = useCallback((message) => {
    if (isMountedRef.current) {
      setState((prev) => ({
        ...prev,
        output: `${prev.output}${new Date().toLocaleTimeString()} ${message}\n`,
      }));
    }
  }, []);

  const handleRemoteCursorPosition = useCallback(
    ({ userId, name, photoURL, position, color, isTyping }) => {
      updateState((prev) => ({
        cursors: {
          ...prev.cursors,
          [userId]: { position, name, photoURL, color, isTyping },
        },
        typingUsers: isTyping
          ? { ...prev.typingUsers, [userId]: { name, photoURL } }
          : Object.fromEntries(
              Object.entries(prev.typingUsers).filter(([id]) => id !== userId)
            ),
      }));
    },
    [updateState]
  );
  // In your socket handlers

  const handleRemoteUserTyping = useCallback(
    ({ userId, name, photoURL, position, color }) => {
      updateState((prev) => ({
        cursors: {
          ...prev.cursors,
          [userId]: { ...prev.cursors[userId], position, isTyping: true },
        },
        typingUsers: {
          ...prev.typingUsers,
          [userId]: { name, photoURL },
        },
      }));
    },
    [updateState]
  );

  // Connection management
  const connectSocket = useCallback(() => {
    if (socketRef.current || !user) return;

    const socket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000",
      {
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 3000,
        timeout: 20000,
        auth: {
          uid: user.uid,
          name: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
        },
      }
    );

    socketRef.current = socket;

    // Connection timer
    const startConnectionTimer = () => {
      clearInterval(connectionTimerRef.current);
      let seconds = 0;
      connectionTimerRef.current = setInterval(() => {
        seconds++;
        updateState({ connectionDuration: seconds });
      }, 1000);
    };

    const stopConnectionTimer = () => {
      clearInterval(connectionTimerRef.current);
    };

    // Event handlers
    const handleConnect = () => {
      reconnectAttemptsRef.current = 0;
      updateState({ isConnected: true });
      appendOutput("[system] Connected to server");
      startConnectionTimer();

      // Debounced room rejoin
      if (state.roomId) {
        clearTimeout(pendingRejoinRef.current);
        pendingRejoinRef.current = setTimeout(() => {
          socket.emit("rejoin-room", state.roomId, (response) => {
            if (response?.success) {
              updateState({
                users: response.users,
                code: response.code,
                ownerId: response.ownerId,
              });
              appendOutput(`[system] Rejoined room ${state.roomId}`);
            } else {
              updateState({ roomId: "" });
            }
          });
        }, 1000);
      }
    };

    const handleDisconnect = () => {
      updateState({ isConnected: false });
      appendOutput("[system] Disconnected from server");
      stopConnectionTimer();
    };

    const handleReconnectAttempt = (attempt) => {
      reconnectAttemptsRef.current = attempt;
      appendOutput(`[system] Reconnecting (attempt ${attempt})`);
    };

    const handleReconnectFailed = () => {
      appendOutput("[system] Reconnection failed");
    };

    const handleRoomData = ({ code, users, ownerId }) => {
      updateState({
        code: code || "// Start coding here...",
        users: users || [],
        ownerId,
        isJoining: false,
        joinError: "",
      });
    };

    const handleUserList = (users) => {
      updateState({ users: users || [] });
    };

    const handleCodeUpdate = (code) => {
      updateState({ code });
    };

    const handleJoinError = (message) => {
      updateState({ joinError: message, isJoining: false });
      appendOutput(`[error] ${message}`);
    };

    const handleUserJoined = (userData) => {
      updateState((prev) => ({
        users: [...prev.users.filter((u) => u.uid !== userData.uid), userData],
      }));
      appendOutput(`[room] ${userData.name} joined the room`);
    };

    const handleUserLeft = (userId) => {
      updateState((prev) => ({
        users: prev.users.filter((user) => user.uid !== userId),
        cursors: Object.fromEntries(
          Object.entries(prev.cursors).filter(([id]) => id !== userId)
        ),
        typingUsers: Object.fromEntries(
          Object.entries(prev.typingUsers).filter(([id]) => id !== userId)
        ),
      }));
      const leftUser = state.users.find((user) => user.uid === userId);
      if (leftUser) {
        appendOutput(`[room] ${leftUser.name} left the room`);
      }
    };

    // Register event listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("reconnect_failed", handleReconnectFailed);
    socket.on("room-data", handleRoomData);
    socket.on("user-list", handleUserList);
    socket.on("code-update", handleCodeUpdate);
    socket.on("join-error", handleJoinError);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);
    socket.on("remote-cursor-position", handleRemoteCursorPosition);
    socket.on("remote-user-typing", handleRemoteUserTyping);

    // Cleanup function
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("reconnect_failed", handleReconnectFailed);
      socket.off("room-data", handleRoomData);
      socket.off("user-list", handleUserList);
      socket.off("code-update", handleCodeUpdate);
      socket.off("join-error", handleJoinError);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
      socket.off("remote-cursor-position", handleRemoteCursorPosition);
      socket.off("remote-user-typing", handleRemoteUserTyping);
      socket.disconnect();
      stopConnectionTimer();
      clearTimeout(pendingRejoinRef.current);
    };
  }, [
    user,
    updateState,
    appendOutput,
    state.roomId,
    handleRemoteCursorPosition,
    handleRemoteUserTyping,
  ]);

  // Room management
  const handleCreateRoom = useCallback(() => {
    if (!user || !socketRef.current) return;

    socketRef.current.emit("create-room", (response) => {
      if (response?.roomId) {
        updateState({
          roomId: response.roomId,
          joinError: "",
          users: [
            {
              uid: user.uid,
              name: user.displayName,
              photoURL: user.photoURL,
              email: user.email,
            },
          ],
          ownerId: user.uid,
        });
        appendOutput(`[room] Created room ${response.roomId}`);
      }
    });
  }, [user, updateState, appendOutput]);

  const handleJoinRoom = useCallback(
    (roomId) => {
      if (!roomId?.trim()) {
        updateState({ joinError: "Please enter a room ID", isJoining: false });
        return;
      }

      if (!socketRef.current?.connected) {
        updateState({
          joinError: "Not connected to server. Please refresh.",
          isJoining: false,
        });
        return;
      }

      updateState({ isJoining: true, joinError: "" });

      socketRef.current.emit("join-room", roomId.trim(), (response) => {
        if (response?.error) {
          updateState({
            joinError: response.error.includes("exist")
              ? "Room expired or doesn't exist"
              : response.error,
            isJoining: false,
            roomId: "",
          });
        } else {
          updateState({
            roomId: roomId.trim(),
            isJoining: false,
            users: response.users,
            code: response.code,
            ownerId: response.ownerId,
            joinError: "",
          });
          appendOutput(`[room] Joined room ${roomId.trim()}`);
        }
      });
    },
    [updateState, appendOutput]
  );

  // Code execution
  const runCode = useCallback(async () => {
    if (state.isRunning) return;

    updateState({ isRunning: true });
    appendOutput("[exec] Running code...");

    // Save original console methods
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
    };

    try {
      // Override console methods to capture output
      const capturedOutput = [];

      console.log = (...args) => {
        capturedOutput.push({ type: "log", args });
        originalConsole.log(...args);
      };

      console.error = (...args) => {
        capturedOutput.push({ type: "error", args });
        originalConsole.error(...args);
      };

      // Execute the code
      const AsyncFunction = Object.getPrototypeOf(
        async function () {}
      ).constructor;
      const fn = new AsyncFunction(`
        try {
          ${state.code}
        } catch (err) {
          console.error(err);
        }
      `);

      await fn();

      // Display captured output
      capturedOutput.forEach(({ type, args }) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
          )
          .join(" ");
        appendOutput(`[${type}] ${message}`);
      });

      appendOutput("[exec] Code execution completed");
    } catch (error) {
      appendOutput(`[error] ${error.message}`);
    } finally {
      // Restore original console methods
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;

      updateState({ isRunning: false });
    }
  }, [state.code, state.isRunning, appendOutput, updateState]);

  // Editor functions
  const setCode = useCallback(
    (code) => {
      updateState({ code });
      if (state.roomId && socketRef.current) {
        socketRef.current.emit("code-change", { roomId: state.roomId, code });
      }
    },
    [state.roomId, updateState]
  );

  const updateCursorPosition = useCallback(
    (position) => {
      if (!state.roomId || !socketRef.current || !user) return;
      socketRef.current.emit("cursor-position", {
        roomId: state.roomId,
        position,
      });
    },
    [state.roomId, user]
  );

  const notifyTyping = useCallback(() => {
    if (!state.roomId || !socketRef.current?.connected || !editorRef.current) {
      console.log("Typing notification blocked - missing requirements");
      return;
    }

    const position = editorRef.current.getPosition();
    console.log("Emitting typing event at position:", position);

    socketRef.current.emit("user-typing", {
      roomId: state.roomId,
      position,
    });

    // Clear any existing timeout
    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      console.log("Auto-clearing typing state after timeout");
      socketRef.current.emit("user-stopped-typing", {
        roomId: state.roomId,
      });
    }, 1500);
  }, [state.roomId]);

  const copyRoomLink = useCallback(() => {
    if (!state.roomId) return;
    navigator.clipboard.writeText(
      `${window.location.origin}?room=${state.roomId}`
    );
    appendOutput("[system] Room link copied to clipboard");
  }, [state.roomId, appendOutput]);

  const clearOutput = useCallback(() => {
    updateState({ output: "" });
  }, [updateState]);

  // Initialize socket connection
  useEffect(() => {
    isMountedRef.current = true;
    const cleanup = connectSocket();
    return () => {
      isMountedRef.current = false;
      cleanup?.();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connectSocket]);

  return {
    ...state,
    socket: socketRef.current,
    handleCreateRoom,
    handleJoinRoom,
    runCode,
    setCode,
    updateCursorPosition,
    notifyTyping,
    copyRoomLink,
    clearOutput,
  };
};
