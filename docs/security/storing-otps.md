# Storing OTPs

CFA permenantly stores your provided OTPs alongside the request, there is no
real **technical** reason for this we could easily wipe them after the request
has been obtained and at some point we might.  Whiling CFA is still in preview
we keep it around for debuggin purposes.  To explain how this doesn't make your
OTP secret less secure I'd like to refer you to the original [OTP RFC]

> Assuming an adversary is able to observe numerous protocol exchanges
> and collect sequences of successful authentication values.  This
> adversary, trying to build a function F to generate HOTP values based
> on his observations, will not have a significant advantage over a
> random guess.

Basically, you can have as many examples of OTPs as you want and it won't make
it any easier for an attacker to guess a valid OTP.
