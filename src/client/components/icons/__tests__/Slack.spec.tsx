import * as React from 'react';
import { shallow } from 'enzyme';
import { SlackLogo } from '../Slack';

describe('SlackLogo Icon', () => {
  it('Should render with a className', () => {
    const wrapper = shallow(<SlackLogo className="test_class_name" />);
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.prop('className')).toBe('test_class_name');
  });
});
