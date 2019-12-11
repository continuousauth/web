import * as React from 'react';
import { BrowserRouter as Router, Route, Switch, RouteComponentProps } from 'react-router-dom';

import { MenuHeader } from './MenuHeader';
import { Dashboard } from './Dashboard';
import { ProjectConfig } from './ProjectConfig';
import { SlackOAuthResult } from './SlackOAuthResult';

function NotFoundHandler(props: RouteComponentProps<any>) {
  React.useEffect(() => {
    props.history.replace('/');
  }, [props.location.pathname]);

  return <h1>Route Not Found</h1>;
}

export function MainAppRouter() {
  return (
    <Router>
      <MenuHeader />
      <Switch>
        <Route path="/" exact component={Dashboard} />
        <Route path="/project/:projectId" exact component={ProjectConfig} />
        <Route path="/oauth_result/slack" exact component={SlackOAuthResult} />
        <Route component={NotFoundHandler} />
      </Switch>
    </Router>
  );
}
