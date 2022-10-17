/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { shallow, mount } from 'enzyme';

import { MenuHeaderInner, isPathActive } from '../MenuHeader';
import { UserState } from '../../state/user';
import { BrowserRouter } from 'react-router-dom';

const fakeLocation = (path: string) => {
  delete (window as any).location;
  window.location = {
    pathname: path,
  } as any;
};

describe('<MenuHeader />', () => {
  it('Should render a logo', () => {
    const wrapper = shallow(<MenuHeaderInner />);
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find('CFALogo')).toHaveLength(1);
  });

  it('should handle the user not being signed in', () => {
    const wrapper = shallow(<MenuHeaderInner />);
    const avatar = wrapper.find('withTheme(Avatar)');
    expect(avatar).toHaveLength(1);
    expect(avatar.prop('name')).toBe('?');
  });

  it('should show the users name when they are signed in', () => {
    function WithUser() {
      return (
        <UserState.Provider value={{ displayName: 'My User' } as any}>
          <BrowserRouter>
            <MenuHeaderInner />
          </BrowserRouter>
        </UserState.Provider>
      );
    }
    const mounted = mount(<WithUser />);
    mounted.setProps({});
    expect(mounted.find('Avatar').prop('name')).toBe('My User');
  });

  it('should highlight the tab for the page that is currently active', () => {
    fakeLocation('/');
    const wrapper = shallow(<MenuHeaderInner />);
    const dashbaordLink = wrapper.find('Link').at(0);
    expect(dashbaordLink.prop('className')).toMatchInlineSnapshot(`"item active"`);
  });

  it('should not highlight the tab for pages that are not currently active', () => {
    fakeLocation('/not/the/dashboard');
    const wrapper = shallow(<MenuHeaderInner />);
    const dashbaordLink = wrapper.find('Link').at(0);
    expect(dashbaordLink.prop('className')).toMatchInlineSnapshot(`"item"`);
  });
});

describe('isPathActive', () => {
  it('should be true for exact matches', () => {
    fakeLocation('/abc');
    expect(isPathActive('/abc', true)).toBe(true);
  });

  it('should be false for child paths if exact is enabled', () => {
    fakeLocation('/abc/def');
    expect(isPathActive('/abc', true)).toBe(false);
  });

  it('should be true for exact matches even if exact is disabled', () => {
    fakeLocation('/abc');
    expect(isPathActive('/abc', false)).toBe(true);
  });

  it('should be true for child paths if exact is disabled', () => {
    fakeLocation('/abc/def');
    expect(isPathActive('/abc', false)).toBe(true);
  });
});
