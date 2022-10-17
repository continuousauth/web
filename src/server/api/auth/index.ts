import * as express from 'express';
import * as passport from 'passport';
import { Strategy } from 'passport-github';
import { ExpressRequest } from '../../helpers/_middleware';

passport.use(
  'github',
  new Strategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL:
        process.env.NODE_ENV !== 'production'
          ? 'http://localhost:3000/api/auth/callback'
          : 'https://continuousauth.dev/api/auth/callback',
      scope: ['repo'],
    },
    (accessToken, refreshToken, profile, cb) => {
      cb(null, {
        accessToken,
        profile: {
          ...profile,
          username: profile.username || '',
        },
      });
    },
  ),
);

passport.serializeUser((u, cb) => cb(null, JSON.stringify(u)));
passport.deserializeUser((u, cb) => cb(null, JSON.parse(u as any)));

export function authRoutes() {
  const router = express();

  router.get('/me', (req: ExpressRequest, res) => {
    if (req.user) return res.json(req.user.profile);
    res.status(404).json({ error: 'Not Signed In' });
  });

  router.get('/login', passport.authenticate('github'));
  router.get('/callback', (req, res, next) => {
    passport.authenticate('github', (err, user) => {
      if (err) return res.redirect('/api/auth/login');
      delete user.profile._raw;
      delete user.profile._json;
      req.login(user, err => {
        if (err) return res.redirect('/api/auth/login');
        res.redirect('/');
      });
    })(req, res, next);
  });

  return router;
}
