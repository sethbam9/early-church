import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import s from "./GuidePage.module.css";
import guideContent from "../../docs/user-guide.md?raw";

export function GuidePage() {
  return (
    <div className={s.root}>
      <div className={s.content}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{guideContent}</ReactMarkdown>
      </div>
    </div>
  );
}
