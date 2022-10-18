import * as React from 'react';
import { shallow } from 'enzyme';
import { CircleCIRequesterConfig } from '../CircleCIRequesterConfig';
import { mockProject } from '../../../../__mocks__/project';

describe('<CircleCIRequesterConfig />', () => {
  it('Should render a GenericAccessTokenRequesterConfig', () => {
    const wrapper = shallow(
      <CircleCIRequesterConfig project={mockProject()} setProject={() => null} />,
    );
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find('GenericAccessTokenRequesterConfig')).toHaveLength(1);
  });

  it('should link users directly to the token generation page for that circleci project', () => {
    const wrapper = shallow(
      <CircleCIRequesterConfig project={mockProject()} setProject={() => null} />,
    );
    const link = wrapper.find('a');
    expect(link).toHaveLength(1);
    expect(link.prop('href')).toBe('https://app.circleci.com/settings/project/github/my-owner/my-repo/api');
  });

  it('should provide an empty original access token if the project is not configured for cirlceci', () => {
    const project = mockProject();
    project.requester_circleCI = null;
    const wrapper = shallow(<CircleCIRequesterConfig project={project} setProject={() => null} />);
    expect(wrapper.find('GenericAccessTokenRequesterConfig').prop('originalAccessToken')).toBe('');
  });

  it('should provide the current access token as the originalAccessToken if the project is configured for circleci', () => {
    const project = mockProject();
    project.requester_circleCI = {
      accessToken: 'my-access-token',
    };
    const wrapper = shallow(<CircleCIRequesterConfig project={project} setProject={() => null} />);
    expect(wrapper.find('GenericAccessTokenRequesterConfig').prop('originalAccessToken')).toBe(
      'my-access-token',
    );
  });
});
