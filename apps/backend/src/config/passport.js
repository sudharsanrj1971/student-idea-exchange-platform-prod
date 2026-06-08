import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User.model.js';

export function configurePassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://api.ichangehub.me/api/auth/google/callback',
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ provider_id: profile.id, auth_provider: 'google' });
          if (!user) {
            const email = profile.emails?.[0]?.value;
            if (email) {
              user = await User.findOne({ email: email.toLowerCase() });
              if (user) {
                user.auth_provider = 'google';
                user.provider_id = profile.id;
                if (!user.profilePic) user.profilePic = profile.photos?.[0]?.value;
                await user.save();
                return done(null, user);
              }
            }
            user = await User.create({
              name: profile.displayName,
              email: email,
              auth_provider: 'google',
              provider_id: profile.id,
              profilePic: profile.photos?.[0]?.value,
              role: 'student',
            });
          }
          return done(null, user);
        } catch (err) {
          console.error('Passport Google Strategy error:', err);
          return done(err, null);
        }
      }
    )
  );
  passport.serializeUser((user, done) => {
    done(null, user._id.toString());
  });
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      if (!user) return done(null, false);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
}

export default passport;
