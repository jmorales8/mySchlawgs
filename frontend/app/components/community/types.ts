import type { SchlawgProfile } from "./profiles/schlawg-profile-dialog";

export type Photo = { id: string; postId?: string | null; batchId?: string | null; batchPosition?: number; animalProfileIds?: string[]; animalProfiles?: SchlawgProfile[]; downloadUrl: string; description: string; ownerId: string | null; username: string | null; profilePhotoUrl: string | null; uploadedAt: string; isUnderReview?: boolean };
