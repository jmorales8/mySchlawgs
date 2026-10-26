import styles from "./community.module.css";

export default function FeedSkeleton({ single = false }: { single?: boolean }) {
  return <div className={styles.feed} role="status" aria-label="Loading posts">
    <span className={styles.srOnly}>Loading moments…</span>
    {Array.from({ length: single ? 1 : 2 }, (_, index) => <div key={index} className={styles.photoCard} aria-hidden="true">
      <header><span className={`${styles.skeleton} ${styles.skeletonAvatar}`} /><div className={styles.skeletonByline}><span className={`${styles.skeleton} ${styles.skeletonLine}`} /><span className={`${styles.skeleton} ${styles.skeletonShort}`} /></div></header>
      <div className={`${styles.skeleton} ${styles.skeletonPhoto}`} />
      <div className={styles.skeletonCaption}><span className={`${styles.skeleton} ${styles.skeletonLine}`} /><span className={`${styles.skeleton} ${styles.skeletonShort}`} /></div>
      <div className={styles.skeletonActions}>{[0, 1, 2].map(item => <span key={item} className={`${styles.skeleton} ${styles.skeletonLine}`} />)}</div>
    </div>)}
  </div>;
}
