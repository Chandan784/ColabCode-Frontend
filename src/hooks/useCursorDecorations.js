import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { SOCKET_OPTIONS } from "../utils/constants";
import { getRandomColor } from "../utils/helpers";

export const useCursorDecorations = (editorRef, roomId, user) => {
  const socketRef = useRef(null);
  const decorationsRef = useRef({});
  const styleTagRef = useRef(null);
  const cursorUpdateTimeoutRef = useRef(null);

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

    // Listen for cursor position updates from other users
    socket.on("cursor-position", ({ userId, position, selection }) => {
      updateRemoteCursor(userId, position, selection);
    });

    // Clean up on unmount
    return () => {
      socket.disconnect();
      if (cursorUpdateTimeoutRef.current) {
        clearTimeout(cursorUpdateTimeoutRef.current);
      }
      cleanupStyles();
    };
  }, [roomId, user]);

  // Clean up existing styles
  const cleanupStyles = useCallback(() => {
    if (styleTagRef.current) {
      styleTagRef.current.remove();
      styleTagRef.current = null;
    }
  }, []);

  // Update remote cursor decorations
  const updateRemoteCursor = useCallback(
    (userId, position, selection) => {
      if (!editorRef.current || !window.monaco) return;

      const model = editorRef.current.getModel();
      if (!model) return;

      // Create or update style for this user's cursor
      const color = getRandomColor(userId);
      const className = `remote-cursor-${userId}`;

      if (!styleTagRef.current) {
        styleTagRef.current = document.createElement("style");
        document.head.appendChild(styleTagRef.current);
      }

      // Add CSS for this cursor
      styleTagRef.current.textContent += `
      .${className} {
        background-color: ${color};
        width: 2px !important;
        margin-left: -1px;
      }
      .${className}-name {
        position: absolute;
        background: ${color};
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
        font-family: sans-serif;
        pointer-events: none;
        z-index: 10;
        transform: translateY(-100%);
      }
    `;

      // Create decorations
      const newDecorations = [];

      // Cursor position
      if (position) {
        newDecorations.push({
          range: new window.monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column + 1
          ),
          options: {
            className: className,
            stickiness:
              window.monaco.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
          },
        });
      }

      // Selection range
      if (selection) {
        newDecorations.push({
          range: new window.monaco.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          ),
          options: {
            className: `${className}-selection`,
            isWholeLine: false,
            inlineClassName: `${className}-selection`,
          },
        });
      }

      // Update decorations
      const oldDecorations = decorationsRef.current[userId] || [];
      const decorationIds = editorRef.current.deltaDecorations(
        oldDecorations,
        newDecorations
      );
      decorationsRef.current[userId] = decorationIds;
    },
    [editorRef]
  );

  // Handle local cursor movement
  const updateCursorPositions = useCallback(() => {
    if (!socketRef.current || !roomId || !editorRef.current || !window.monaco)
      return;

    const position = editorRef.current.getPosition();
    const selection = editorRef.current.getSelection();

    // Throttle updates
    if (cursorUpdateTimeoutRef.current) {
      clearTimeout(cursorUpdateTimeoutRef.current);
    }

    cursorUpdateTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit("cursor-position", {
        roomId,
        position,
        selection,
      });
    }, 100);
  }, [roomId, editorRef]);

  // Clean up decorations when users leave
  const removeCursorDecorations = useCallback(
    (userId) => {
      if (!editorRef.current || !decorationsRef.current[userId]) return;

      editorRef.current.deltaDecorations(decorationsRef.current[userId], []);
      delete decorationsRef.current[userId];
    },
    [editorRef]
  );

  return {
    updateCursorPositions,
    removeCursorDecorations,
  };
};
