import { verifyGravatarExists, getGravatarUrl } from '../src/utils/gravatar.js';

async function test() {
  const email = 'sudharsanrj1971@gmail.com';
  const exists = await verifyGravatarExists(email);
  console.log(`Gravatar exists for ${email}:`, exists);
  if (exists) {
    console.log(`URL:`, getGravatarUrl(email));
  }
}

test();
