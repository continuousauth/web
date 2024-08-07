import * as React from 'react';

import { Avatar, WarningSignIcon, Pane } from 'evergreen-ui';
import { UserState } from '../state/user';

import styles from './MenuHeader.scss';
import { CFALogo } from './icons/Logo';
import { cx } from '../utils';
import { Link, withRouter } from 'react-router-dom';

export const isPathActive = (path: string, exact = true) => {
  if (exact) return location.pathname === path;
  return location.pathname.indexOf(path) === 0;
};

export function MenuHeaderInner() {
  const user = React.useContext(UserState);

  return (
    <Pane className={styles.container}>
      <CFALogo className={styles.logo} />
      <span className={styles.productName}>CFA</span>
      <Link className={cx(styles.item, (isPathActive('/') && styles.active) || null)} to="/">
        Dashboard
      </Link>
      <a className={styles.item} href="https://docs.continuousauth.dev" target="_blank">
        Documentation
      </a>
      <div className={cx(styles.item, styles.warning)}>
        <WarningSignIcon color="warning" marginRight={8} />
        CFA is open-source and does not have formal support
      </div>
      <Pane className={styles.right}>
        <Avatar
          name={user ? user.displayName : '?'}
          size={24}
          src={user ? `https://github.com/${user.username}.png` : undefined}
        />
        <span>{user ? user.username : '?'}</span>
      </Pane>
      <span></span>
    </Pane>
  );
}

export const MenuHeader = withRouter(MenuHeaderInner);
