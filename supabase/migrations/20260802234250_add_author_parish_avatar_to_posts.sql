/*
# Add author_parish and author_avatar columns to posts

1. New Columns
- `posts.author_parish` (text, nullable) — parish of the post author
- `posts.author_avatar` (text, nullable) — avatar URL of the post author

2. Purpose
- Enables the feed and reels views to display author parish and avatar
  without a separate join to the profiles table.
*/

ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_parish text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_avatar text;
