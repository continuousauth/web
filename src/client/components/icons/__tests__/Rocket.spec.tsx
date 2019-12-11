import * as React from 'react';
import { shallow } from 'enzyme';
import { Rocket } from '../Rocket';

describe('Rocket Icon', () => {
  it('Should render with a className', () => {
    const wrapper = shallow(<Rocket className="test_class_name" />);
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.prop('className')).toBe('test_class_name');
  });
});
