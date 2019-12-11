const Adapter = require('enzyme-adapter-react-16');

require('enzyme').configure({
  adapter: new Adapter()
});

process.env.SLACK_SIGNING_SECRET = 1;
process.env.SLACK_CLIENT_ID = 1;
process.env.SLACK_CLIENT_SECRET = 1;
process.env.SESSION_SECRET = 1;
process.env.GITHUB_CLIENT_ID = 1;
process.env.GITHUB_CLIENT_SECRET = 1;
