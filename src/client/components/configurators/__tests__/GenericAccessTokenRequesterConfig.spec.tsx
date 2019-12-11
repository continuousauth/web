import * as React from 'react';
import { shallow } from 'enzyme';
import { GenericAccessTokenRequesterConfig } from '../GenericAccessTokenRequesterConfig';
import { mockProject } from '../../../../__mocks__/project';

describe('<GenericAccessTokenRequesterConfig />', () => {
  beforeEach(() => {
    (global as any).Headers = function(o) {
      return o;
    } as any;
  });
  afterEach(() => {
    delete (global as any).Headers;
  });

  it('Should render a TextInput for the access token', () => {
    const wrapper = shallow(
      <GenericAccessTokenRequesterConfig
        project={mockProject()}
        setProject={() => null}
        originalAccessToken=""
        slug="circleci"
        requesterName="My Requester"
      >
        <p>Children</p>
      </GenericAccessTokenRequesterConfig>,
    );
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find('withTheme(TextInput)')).toHaveLength(1);
  });
});
