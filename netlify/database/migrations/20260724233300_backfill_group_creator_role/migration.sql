UPDATE "group_members" AS "membership"
SET "role" = 'creator'::"group_member_role"
FROM "groups"
WHERE "membership"."group_id" = "groups"."id"
  AND "membership"."user_id" = "groups"."created_by";
