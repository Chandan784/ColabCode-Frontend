import { useEffect } from "react";

export const useEditor = (editorRef) => {
  useEffect(() => {
    if (!editorRef.current || !window.monaco) return;

    const setupEditor = () => {
      window.monaco.editor.defineTheme("collab-theme", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#1e1e1e",
          "editorCursor.foreground": "#ffffff",
        },
      });
      window.monaco.editor.setTheme("collab-theme");
    };

    setupEditor();
  }, [editorRef]);

  return {};
};
