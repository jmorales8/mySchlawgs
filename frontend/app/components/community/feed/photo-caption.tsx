import styles from "./photo-caption.module.css";
import type { Photo } from "../types";

export default function PhotoCaption({ photo }: { photo: Photo }) {
  return photo.description ? <div className={styles.caption}><p>{photo.description}</p></div> : null;
}
