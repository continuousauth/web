# Requesters

On CFA a Requester is the CFA component responsible for receiving **incoming**
OTP requests from third party services such as your CI providers and performing
the following set of operations on them (all Requesters must at a minimum
perform these steps).

## Receive the request

This normally happens through an HTTP endpoint in the format:

`POST /api/request/:projectId/:requesterKey`

The POST body varies depending on the requester, check out the requester
documentation to figure out what should be in the body of the request or
just use the `@continuous-auth/client` module which handles all of this
for you.

## Validate the project

This is _mostly_ handled by a piece of global middleware registered for
`/api/request/:projectId` that will reject requests for disabled projects,
projects that have incomplete setups and projects that do not exist.

The individual requester should ensure that itself is completely configured
before processing any incoming messages.  If any config is missing or invalid
instantly stop processing the request.

## Validate the request

Once a request for an OTP has been recieved the Requester on CFA should ensure
that we aren't being lied to or tricked / middle-manned in some way.  For a
hypthetical CI service this would include:

* Require the POST body include the build number
* Ensure that build is running
* Ensure that build is on the default branch of the repository
* Ensure that build was naturally triggered (not manually triggered by a user)
* Ensure (if possible) that users can't ssh into the build job while it's running
or that no user has connected to the job.

## Request the token from the registered Responder

Once everything has been validated the requester will finally look up the
configured responder for the current project and send the OTP request.

# Implementation

Implementing a new requester just requires that you implement the [`Requester`](../../src/server/requesters/Requester.ts)
interface and register the new requester routes in [`src/server/api/request/index.ts`](../../src/server/api/request/index.ts).  Check the usage of `createRequesterRoutes`.

You should review existing implementations to get a good idea of code style and the
intention behind the methods in the interface.
