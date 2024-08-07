/**
 * @jest-environment jsdom
 */

jest.mock('../configurators/CircleCIRequesterConfig', () => ({
  CircleCIRequesterConfig: () => null,
}));

import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { shallow, mount } from 'enzyme';
import { RequesterConfig } from '../RequesterConfig';
import { mockProject } from '../../../__mocks__/project';

describe('<RequesterConfig />', () => {
  it('Should render', () => {
    const setProject = jest.fn();
    const wrapper = shallow(<RequesterConfig project={mockProject()} setProject={setProject} />);
    expect(wrapper).toMatchSnapshot();
  });
  it('Should render a help box by default', () => {
    const setProject = jest.fn();
    const mounted = shallow(<RequesterConfig project={mockProject()} setProject={setProject} />);
    expect(mounted.find('Memo(ForwardRef(Alert))')).toHaveLength(1);
  });

  it('Should hide the help box when it is closed', () => {
    const setProject = jest.fn();
    const mounted = shallow(<RequesterConfig project={mockProject()} setProject={setProject} />);
    act(() => (mounted.find('Memo(ForwardRef(Alert))').prop('onRemove') as Function)());
    mounted.setProps({});
    expect(mounted.find('Memo(ForwardRef(Alert))')).toHaveLength(0);
  });

  it.skip('Should reopen the help box for a new project if it is closed', () => {
    const setProject = jest.fn();
    const mounted = shallow(<RequesterConfig project={mockProject()} setProject={setProject} />);
    act(() => (mounted.find('Memo(ForwardRef(Alert))').prop('onRemove') as Function)());
    mounted.setProps({});
    expect(mounted.find('Memo(ForwardRef(Alert))')).toHaveLength(0);
    mounted.setProps({
      project: mockProject(),
    });
    mounted.setProps({});
    expect(mounted.find('Memo(ForwardRef(Alert))')).toHaveLength(1);
  });

  it('should ask us to configure a requester if none is configured', () => {
    const setProject = jest.fn();
    const project = mockProject();
    const mounted = shallow(<RequesterConfig project={project} setProject={setProject} />);
    expect(
      mounted
        .find('Memo(ForwardRef(Paragraph))')
        .at(0)
        .text()
        .includes('choose one'),
    ).toBeTruthy();
  });

  it('Should show the circleci configurator when that tab is selected', () => {
    const setProject = jest.fn();
    const mounted = shallow(<RequesterConfig project={mockProject()} setProject={setProject} />);
    expect(mounted.find('CircleCIRequesterConfig')).toHaveLength(0);
    act(() =>
      (mounted
        .find('Memo(ForwardRef(Tab))')
        .at(0)
        .prop('onSelect') as Function)(),
    );
    mounted.setProps({});
    expect(mounted.find('CircleCIRequesterConfig')).toHaveLength(1);
  });

  it('Should show the circleci configurator when circleci has been configured on the provided project', () => {
    const setProject = jest.fn();
    const project = mockProject();
    project.requester_circleCI = {
      accessToken: 'test123',
    };
    const mounted = mount(<RequesterConfig project={project} setProject={setProject} />);
    expect(mounted.find('CircleCIRequesterConfig')).toHaveLength(1);
  });
});
