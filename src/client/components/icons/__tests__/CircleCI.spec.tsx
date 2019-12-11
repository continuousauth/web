import * as React from 'react';
import { shallow } from 'enzyme';
import { CircleCILogo } from '../CircleCI';

describe('CircleCI Icon', () => {
  it('Should render with a className', () => {
    const wrapper = shallow(<CircleCILogo className="test_class_name" />);
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.prop('className')).toBe('test_class_name');
  });
});
