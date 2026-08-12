import { getStore } from "@netlify/blobs";

export default async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405
    });
  }

  try {
    const body = await request.json();
    const visitorId = body.visitorId;

    if (
      !visitorId ||
      typeof visitorId !== "string" ||
      visitorId.length > 100
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid visitor ID" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const store = getStore({
      name: "mtb-visitors",
      consistency: "strong"
    });

    /*
      Use Eastern Time for the public "Visitors Today" number.
    */
    const easternDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .format(new Date());

    /*
      Store one permanent entry per browser for lifetime uniques.
      onlyIfNew prevents the same browser from being added twice.
    */
    await store.set(
      `total/${visitorId}`,
      "1",
      { onlyIfNew: true }
    );

    /*
      Store one entry for this browser for this calendar day.
    */
    await store.set(
      `daily/${easternDate}/${visitorId}`,
      "1",
      { onlyIfNew: true }
    );

    /*
      Count today's unique visitor entries.
    */
    const todayResults = await store.list({
      prefix: `daily/${easternDate}/`
    });

    /*
      Count lifetime unique visitor entries.
    */
    const totalResults = await store.list({
      prefix: "total/"
    });

    return new Response(
      JSON.stringify({
        today: todayResults.blobs.length,
        total: totalResults.blobs.length
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error: "Unable to retrieve visitor counts"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};