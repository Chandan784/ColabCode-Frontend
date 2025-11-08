import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { SOCKET_OPTIONS } from "../utils/constants";
import { generateUserColor } from "../utils/helpers";

export const useTypingIndicators = (roomId, user) => {
  const [typingUsers, setTypingUsers] = useState({});
  const [userCursors, setUserCursors] = useState({});
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (!roomId || !user) return;

    const socket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000",
      {
        ...SOCKET_OPTIONS,
        auth: {
          uid: user.uid,
          name: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
        },
      }
    );

    socketRef.current = socket;

    // Listen for typing events
    socket.on("user-typing", (userId) => {
      setTypingUsers((prev) => ({
        ...prev,
        [userId]: prev[userId] || user.displayName,
      }));
    });

    socket.on("user-stopped-typing", (userId) => {
      setTypingUsers((prev) => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    });

    // Listen for cursor position updates
    socket.on("cursor-position", ({ userId, position }) => {
      setUserCursors((prev) => ({
        ...prev,
        [userId]: {
          name: user.displayName,
          color: generateUserColor(userId),
          position,
        },
      }));
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomId, user]);

  // Handle local user typing
  const handleUserTyping = useCallback(() => {
    if (!socketRef.current || !roomId) return;

    // Emit typing event
    socketRef.current.emit("user-typing", roomId);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit("user-stopped-typing", roomId);
    }, 1500);
  }, [roomId]);

  // Handle cursor position updates
  const updateCursorPosition = useCallback(
    (position) => {
      if (!socketRef.current || !roomId) return;

      socketRef.current.emit("cursor-position", {
        roomId,
        position,
      });
    },
    [roomId]
  );

  return {
    typingUsers,
    userCursors,
    handleUserTyping,
    updateCursorPosition,
  };
};
