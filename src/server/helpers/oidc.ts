import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import * as jwkToPem from 'jwk-to-pem';

import { Project } from '../db/models';
import { Requester } from '../requesters/Requester';
import { Issuer } from 'openid-client';

export const getSignatureValidatedOIDCClaims = async <R, M>(
  requester: Requester<R, M>,
  project: Project,
  config: R,
  token: string,
): Promise<jwt.Jwt | null> => {
  const discoveryUrl = await requester.getOpenIDConnectDiscoveryURL(project, config);
  if (!discoveryUrl) throw 'Project is not eligible for OIDC credential exchange';
  const issuer = await Issuer.discover(discoveryUrl);

  if (!issuer.metadata.jwks_uri)
    throw 'Project is not eligible for JWKS backed OIDC credential exchange';
  const jwks = await axios.get(issuer.metadata.jwks_uri);

  if (jwks.status !== 200) throw 'Project is not eligible for JWKS backed OIDC credential exchange';

  let claims = jwt.decode(token, { complete: true }) as jwt.Jwt | null;
  if (!claims) throw 'Invalid OIDC token provided';
  const key = jwks.data.keys.find((key) => key.kid === claims!.header.kid);

  if (!key) throw 'Invalid kid found in the token provided';

  const pem = jwkToPem(key);
  try {
    claims = jwt.verify(token, pem, { complete: true, algorithms: [key.alg] }) as jwt.Jwt | null;
  } catch {
    throw 'Could not verify the provided token against the OIDC provider';
  }
  return claims;
};
