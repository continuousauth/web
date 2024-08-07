import * as React from 'react';
import { shallow } from 'enzyme';
import { GitHubLogo } from '../GitHub';

describe('GitHubLogo Icon', () => {
  it('Should render with a className', () => {
    const wrapper = shallow(<GitHubLogo className="test_class_name" />);
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.prop('className')).toBe('test_class_name');
  });
});
