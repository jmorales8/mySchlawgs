import styles from "./hover-letters.module.css";

const segmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

export default function HoverLetters({ text }: { text: string }) {
  return <span aria-hidden="true">
    {text.split(/(\s+)/).map((part, index) => {
      if (!part || /^\s+$/.test(part)) return part;
      const letters = segmenter ? Array.from(segmenter.segment(part), item => item.segment) : Array.from(part);
      return <span key={index} className={styles.word}>
        {letters.map((letter, position) => <span key={position} className={styles.letter}><span>{letter}</span></span>)}
      </span>;
    })}
  </span>;
}
