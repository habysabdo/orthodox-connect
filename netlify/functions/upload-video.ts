import type { Config } from '@netlify/functions';
import { authorizeBunnyUpload } from './get-bunny-upload-url.js';

// The previous name for the upload authorization endpoint, kept working so a
// browser running an older cached bundle can still post a video.
//
// `get-bunny-upload-url.ts` holds the implementation and is what the app calls.

export default authorizeBunnyUpload;

export const config: Config = {
  path: '/api/upload-video',
};
