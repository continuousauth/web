import * as React from 'react';
import { shallow } from 'enzyme';
import { TravisCIRequesterConfig } from '../TravisCIRequesterConfig';
import { mockProject } from '../../../../__mocks__/project';

describe('<TravisCIRequesterConfig />', () => {
  it('Should render a GenericAccessTokenRequesterConfig', () => {
    const wrapper = shallow(
      <TravisCIRequesterConfig project={mockProject()} setProject={() => null} />,
    );
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find('GenericAccessTokenRequesterConfig')).toHaveLength(1);
  });

  it('should link users to the travis ci settings page', () => {
    const wrapper = shallow(
      <TravisCIRequesterConfig project={mockProject()} setProject={() => null} />,
    );
    const link = wrapper.find('a');
    expect(link).toHaveLength(1);
    expect(link.prop('href')).toBe('https://travis-ci.org/account/preferences');
  });

  it('should provide an empty original access token if the project is not configured for travisci', () => {
    const project = mockProject();
    project.requester_travisCI = null;
    const wrapper = shallow(<TravisCIRequesterConfig project={project} setProject={() => null} />);
    expect(wrapper.find('GenericAccessTokenRequesterConfig').prop('originalAccessToken')).toBe('');
  });

  it('should provide the current access token as the originalAccessToken if the project is configured for travisci', () => {
    const project = mockProject();
    project.requester_travisCI = {
      accessToken: 'my-access-token',
    };
    const wrapper = shallow(<TravisCIRequesterConfig project={project} setProject={() => null} />);
    expect(wrapper.find('GenericAccessTokenRequesterConfig').prop('originalAccessToken')).toBe(
      'my-access-token',
    );
  });
});
