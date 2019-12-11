import * as React from 'react';
import { shallow } from 'enzyme';
import { CFALogo } from '../Logo';

describe('CFALogo Icon', () => {
  it('Should render with a className', () => {
    const wrapper = shallow(<CFALogo className="test_class_name" />);
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.prop('className')).toBe('test_class_name');
  });
});
