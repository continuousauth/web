/* istanbul ignore file */
import * as React from 'react';

import { User } from '../../common/types';

export const UserState = React.createContext<User | null>(null);
