FROM public.ecr.aws/supabase/postgres:17.6.1.071@sha256:4255b662ba3d774105cb34f623e410a3d7a860b68408ac6810f7e7e4b9781d5a
USER root
RUN apt-get update && apt-get install -y --no-install-recommends libfaketime=0.9.10-2.1 && rm -rf /var/lib/apt/lists/* && cp /usr/lib/*/faketime/libfaketime.so.1 /usr/local/lib/job-clock.so.1
USER postgres
