import { refreshAll } from "../src/lib/pipeline";

refreshAll((message) => {
  console.log(message);
})
  .then((cache) => {
    console.log(`events ${cache.events.length}`);
    for (const row of cache.report) {
      console.log(
        `${row.source}\tfetched=${row.fetched}\tupstream=${row.upstream ?? "-"}\tkept=${row.kept}\t${row.error ?? ""}`,
      );
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
