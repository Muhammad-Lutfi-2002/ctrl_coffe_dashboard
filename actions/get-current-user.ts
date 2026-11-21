import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { currentActor } from "../server/services/common.js";

export default defineAction({
  description: "Profil dan peran pengguna yang sedang masuk (diambil dari sesi server).",
  schema: z.object({}),
  http: { method: "GET" },
  run: async () => {
    const a = await currentActor();
    return { idUsers: a.idUsers, email: a.email, fullName: a.fullName, roleCode: a.roleCode };
  },
});
