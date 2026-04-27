import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import EmailEditor, { type EditorRef } from "react-email-editor";

export interface UnlayerEditorHandle {
  exportHtml: () => Promise<{ html: string; design: any }>;
  loadDesign: (design: any) => void;
}

interface Props {
  initialDesign?: any | null;
  projectId?: number;
  /** Variables shown in the merge-tag dropdown inside Unlayer */
  mergeTags?: Record<string, { name: string; value: string; sample?: string }>;
  height?: number;
}

/**
 * Wrapper around the Unlayer (react-email-editor) drag-and-drop editor.
 * - projectId is your free Unlayer project ID; without it, the editor
 *   still works in demo mode but shows an Unlayer banner.
 * - Set VITE_UNLAYER_PROJECT_ID in your env to remove the banner.
 */
const UnlayerEditor = forwardRef<UnlayerEditorHandle, Props>(
  ({ initialDesign, projectId, mergeTags, height = 600 }, ref) => {
    const editorRef = useRef<EditorRef | null>(null);
    const loadedRef = useRef(false);

    useImperativeHandle(ref, () => ({
      exportHtml: () =>
        new Promise((resolve) => {
          editorRef.current?.editor?.exportHtml((data: any) => {
            resolve({ html: data.html, design: data.design });
          });
        }),
      loadDesign: (design: any) => {
        if (design) editorRef.current?.editor?.loadDesign(design);
      },
    }));

    // (Re)load when initialDesign changes after the editor mounts.
    useEffect(() => {
      if (loadedRef.current && initialDesign) {
        editorRef.current?.editor?.loadDesign(initialDesign);
      }
    }, [initialDesign]);

    const onReady = () => {
      loadedRef.current = true;
      if (initialDesign) editorRef.current?.editor?.loadDesign(initialDesign);
    };

    return (
      <div className="rounded-lg overflow-hidden border border-border/40 bg-background">
        <EmailEditor
          ref={editorRef as any}
          onReady={onReady}
          minHeight={height}
          options={{
            projectId: projectId || Number(import.meta.env.VITE_UNLAYER_PROJECT_ID) || undefined,
            displayMode: "email",
            appearance: { theme: "dark" } as any,
            mergeTags: mergeTags as any,
          }}
        />
      </div>
    );
  }
);

UnlayerEditor.displayName = "UnlayerEditor";
export default UnlayerEditor;
