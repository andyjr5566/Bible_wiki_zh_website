import type { Feature } from "../types"
import { BackupView } from "./backupView"

export const backupFeature: Feature = {
  id: "backup",
  views: {
    mynotes: ({ session, host }) => new BackupView(session, host),
  },
}
