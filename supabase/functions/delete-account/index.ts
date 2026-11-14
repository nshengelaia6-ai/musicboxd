
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405 }
      );
    }

    try {
      // Identity comes only from the verified user's JWT.
      const userId = ctx.userClaims?.id;

      if (!userId || ctx.authMode !== "user") {
        return Response.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      // Require password authentication within the last 5 minutes.
     const claims = ctx.jwtClaims as {
  amr?: unknown;
} | null;

const now = Math.floor(Date.now() / 1000);
const amr = claims?.amr;

const recentPasswordAuth =
  Array.isArray(amr) &&
  amr.some((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) {
      return false;
    }

    const authMethod = entry as {
      method?: unknown;
      timestamp?: unknown;
    };

    return (
      authMethod.method === "password" &&
      typeof authMethod.timestamp === "number" &&
      now - authMethod.timestamp <= 300 &&
      authMethod.timestamp <= now + 30
    );
  });

      if (!recentPasswordAuth) {
        return Response.json(
          {
            error:
              "Please re-enter your password before deleting your account."
          },
          { status: 403 }
        );
      }

      // Delete only data associated with this authenticated user.
      const { error: cleanupError } =
        await ctx.supabaseAdmin.rpc("delete_account_data", {
          p_auth_user_id: userId,
        });

      if (cleanupError) {
        console.error("Account cleanup failed:", cleanupError);

        return Response.json(
          {
            error:
              "Could not delete account data. Account was not deleted."
          },
          { status: 500 }
        );
      }

      // Permanently delete this Supabase Auth account.
      const { error: deleteError } =
        await ctx.supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        console.error("Auth deletion failed:", deleteError);

        return Response.json(
          {
            error:
              "Application data was deleted, but account deletion failed. Please retry.",
            dataDeleted: true,
          },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        message: "Account deleted successfully.",
      });

    } catch (error) {
      console.error("Delete account error:", error);

      return Response.json(
        { error: "Unexpected error while deleting account." },
        { status: 500 }
      );
    }
  }),
};
