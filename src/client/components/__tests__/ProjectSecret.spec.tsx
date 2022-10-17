/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { mount, shallow } from 'enzyme';
import { ProjectSecret } from '../ProjectSecret';

import { mockProject } from '../../../__mocks__/project';

describe('<ProjectSecret />', () => {
  it('Should render a disabled input', () => {
    const wrapper = shallow(<ProjectSecret project={mockProject()} />);
    expect(wrapper).toMatchSnapshot();
    const mounted = mount(<ProjectSecret project={mockProject()} />);
    expect(mounted.find('ForwardRef(Button)')).toHaveLength(1);
  });

  it('should initially dispplay asterix (not the secret)', () => {
    const mounted = mount(<ProjectSecret project={mockProject()} />);
    expect(
      mounted
        .find('ForwardRef(Button)')
        .children()
        .text(),
    ).toMatchInlineSnapshot(`"Show"`);
    expect(mounted.find('ForwardRef(TextInput)').prop('value')).toMatchInlineSnapshot(
      `"••••••••••••••••••••••••••••••••••••••••••••••••••"`,
    );
  });

  it('should toggle to display the secret when the button is clicked', () => {
    const mounted = mount(<ProjectSecret project={mockProject()} />);
    mounted.find('ForwardRef(Button)').simulate('click');
    expect(
      mounted
        .find('ForwardRef(Button)')
        .children()
        .text(),
    ).toMatchInlineSnapshot(`"Hide"`);
    expect(mounted.find('ForwardRef(TextInput)').prop('value')).toBe(mockProject().secret);
  });
});
