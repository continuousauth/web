import * as React from 'react';
import { shallow } from 'enzyme';
import { MainAppRouter } from '../MainAppRouter';

describe('<MainAppRouter />', () => {
  it('Should render a router', () => {
    const wrapper = shallow(<MainAppRouter />);
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find('BrowserRouter')).toHaveLength(1);
  });
});
