import sharedStyles from "../community.module.css";
import styles from "./feed-skeleton.module.css";

export default function FeedSkeleton({ single = false }: { single?: boolean }) {
  return <div className={sharedStyles.feed} role="status" aria-label="Loading posts">
    <span className={sharedStyles.srOnly}>Loading moments…</span>
    {Array.from({ length: single ? 1 : 2 }, (_, index) => <div key={index} className={sharedStyles.photoCard} aria-hidden="true">
      <header><span className={`${sharedStyles.skeleton} ${styles.skeletonAvatar}`} /><div className={styles.skeletonByline}><span className={`${sharedStyles.skeleton} ${styles.skeletonLine}`} /><span className={`${sharedStyles.skeleton} ${styles.skeletonShort}`} /></div></header>
      <div className={`${sharedStyles.skeleton} ${styles.skeletonPhoto}`} />
      <div className={styles.skeletonCaption}><span className={`${sharedStyles.skeleton} ${styles.skeletonLine}`} /><span className={`${sharedStyles.skeleton} ${styles.skeletonShort}`} /></div>
      <div className={styles.skeletonActions}>{[0, 1, 2].map(item => <span key={item} className={`${sharedStyles.skeleton} ${styles.skeletonLine}`} />)}</div>
    </div>)}
  </div>;
}
