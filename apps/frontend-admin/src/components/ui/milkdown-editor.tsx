import { Crepe } from "@milkdown/crepe";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { forwardRef, useImperativeHandle, useRef } from "react";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "@/styles/milkdown.css";

export interface MilkdownEditorRef {
  getMarkdown: () => string;
}

interface MilkdownEditorProps {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
}

const MilkdownEditorInner = forwardRef<MilkdownEditorRef, MilkdownEditorProps>(
  ({ defaultValue = "", onChange, placeholder = "开始写作..." }, ref) => {
    const crepeRef = useRef<Crepe | null>(null);
    const [loading] = useInstance();

    useEditor(root => {
      const crepe = new Crepe({
        root,
        defaultValue,
        features: {
          [Crepe.Feature.Toolbar]: true,
          [Crepe.Feature.BlockEdit]: true,
          [Crepe.Feature.ImageBlock]: true,
          [Crepe.Feature.Table]: true,
          [Crepe.Feature.CodeMirror]: true,
          [Crepe.Feature.ListItem]: true,
          [Crepe.Feature.LinkTooltip]: true,
          [Crepe.Feature.Cursor]: true,
          [Crepe.Feature.Placeholder]: true,
        },
        featureConfigs: {
          [Crepe.Feature.Placeholder]: {
            text: placeholder,
            mode: "block",
          },
        },
      });

      crepe.on(listener => {
        listener.markdownUpdated((_ctx, markdown) => {
          onChange?.(markdown);
        });
      });

      crepeRef.current = crepe;
      return crepe;
    }, []);

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (loading || !crepeRef.current) return defaultValue;
        return crepeRef.current.getMarkdown();
      },
    }));

    return <Milkdown />;
  },
);

MilkdownEditorInner.displayName = "MilkdownEditorInner";

export const MilkdownEditor = forwardRef<MilkdownEditorRef, MilkdownEditorProps>((props, ref) => {
  return (
    <MilkdownProvider>
      <div className="milkdown-editor-wrapper rounded-md border">
        <MilkdownEditorInner ref={ref} {...props} />
      </div>
    </MilkdownProvider>
  );
});

MilkdownEditor.displayName = "MilkdownEditor";
