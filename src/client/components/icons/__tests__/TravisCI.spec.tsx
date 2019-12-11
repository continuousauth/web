import * as React from 'react';
import { shallow } from 'enzyme';
import { TravisCILogo } from '../TravisCI';

describe('TravisCILogo Icon', () => {
  it('Should render with a className', () => {
    const wrapper = shallow(<TravisCILogo className="test_class_name" />);
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.prop('className')).toBe('test_class_name');
  });
});
