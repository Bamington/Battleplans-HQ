/**
 * RichTextEditor.tsx — TipTap-based rich text editor with markdown I/O
 *
 * A dark-themed WYSIWYG editor that reads and writes markdown. Built on
 * TipTap with StarterKit (bold, italic, strike, headings, lists, blockquote)
 * plus the Underline extension.
 *
 * USAGE:
 *   <RichTextEditor
 *     value={markdown}
 *     onChange={setMarkdown}
 *     placeholder="Write something…"
 *   />
 */

import { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RichTextEditorProps {
  /** Markdown string to display in the editor */
  value: string;
  /** Called with the updated markdown string on every content change */
  onChange: (md: string) => void;
  /** Placeholder shown when the editor is empty */
  placeholder?: string;
  /** Extra Tailwind classes on the root wrapper */
  className?: string;
}

// ── Toolbar button ────────────────────────────────────────────────────────────

interface ToolbarBtnProps {
  onClick: () => void;
  active?: boolean;
  title:   string;
  children: React.ReactNode;
}

const ToolbarBtn = ({ onClick, active, title, children }: ToolbarBtnProps) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={[
      'px-1.5 py-1 rounded text-xs font-body font-semibold transition-colors',
      active
        ? 'bg-gray-500 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-600',
    ].join(' ')}
  >
    {children}
  </button>
);

// ── Divider ───────────────────────────────────────────────────────────────────

const ToolbarDivider = () => (
  <div className="w-px h-5 bg-gray-600 mx-0.5" />
);

// ── Component ─────────────────────────────────────────────────────────────────

const RichTextEditor = ({
  value,
  onChange,
  placeholder = '',
  className = '',
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[160px] px-3 py-2.5 font-body text-sm text-white',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = (ed.storage as any).markdown.getMarkdown() as string;
      onChange(md);
    },
  });

  // Sync external value changes into the editor (e.g. on modal open/reset)
  const editorMdRef = useCallback(() => {
    if (!editor) return '';
    return (editor.storage as any).markdown.getMarkdown() as string;
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editorMdRef();
    if (current !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor, editorMdRef]);

  if (!editor) return null;

  return (
    <div className={`rounded-lg border border-gray-600 bg-gray-700 overflow-hidden ${className}`}>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-600 bg-gray-800">
        {/* Inline formatting */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          B
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <span className="underline">U</span>
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </ToolbarBtn>

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          H1
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarBtn>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
            <circle cx="2" cy="4" r="1.5" />
            <rect x="5" y="3" width="10" height="2" rx="0.5" />
            <circle cx="2" cy="8" r="1.5" />
            <rect x="5" y="7" width="10" height="2" rx="0.5" />
            <circle cx="2" cy="12" r="1.5" />
            <rect x="5" y="11" width="10" height="2" rx="0.5" />
          </svg>
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
            <text x="0" y="5.5" fontSize="5" fontWeight="bold">1</text>
            <rect x="5" y="3" width="10" height="2" rx="0.5" />
            <text x="0" y="9.5" fontSize="5" fontWeight="bold">2</text>
            <rect x="5" y="7" width="10" height="2" rx="0.5" />
            <text x="0" y="13.5" fontSize="5" fontWeight="bold">3</text>
            <rect x="5" y="11" width="10" height="2" rx="0.5" />
          </svg>
        </ToolbarBtn>

        <ToolbarDivider />

        {/* Blockquote */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
            <rect x="0" y="2" width="2.5" height="12" rx="1" />
            <rect x="5" y="4" width="10" height="2" rx="0.5" />
            <rect x="5" y="8" width="8" height="2" rx="0.5" />
          </svg>
        </ToolbarBtn>
      </div>

      {/* ── Editor content ──────────────────────────────────────────── */}
      <EditorContent editor={editor} />

      {/* ── Placeholder + prose styles ──────────────────────────────── */}
      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .tiptap {
          min-height: 160px;
        }
        .tiptap > * + * {
          margin-top: 0.4em;
        }
        .tiptap ul {
          list-style-type: disc;
          padding-left: 1.2em;
        }
        .tiptap ol {
          list-style-type: decimal;
          padding-left: 1.2em;
        }
        .tiptap blockquote {
          border-left: 3px solid #6b7280;
          padding-left: 0.8em;
          color: #d1d5db;
        }
        .tiptap h1 { font-size: 1.25em; font-weight: 700; }
        .tiptap h2 { font-size: 1.125em; font-weight: 700; }
        .tiptap h3 { font-size: 1em; font-weight: 700; }
        .tiptap strong { font-weight: 700; }
        .tiptap u { text-decoration: underline; }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
