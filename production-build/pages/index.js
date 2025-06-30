export default function Home() {
  // This is just a placeholder - we'll redirect to our static HTML
  return null;
}

// Redirect to our static HTML file
export async function getServerSideProps({ res }) {
  if (res) {
    res.setHeader("Location", "/index.html");
    res.statusCode = 302;
    res.end();
  }
  return { props: {} };
}