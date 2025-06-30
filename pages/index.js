export default function Home() {
  return null;
}

export async function getServerSideProps({ res }) {
  if (res) {
    res.setHeader('Location', '/index.html');
    res.statusCode = 302;
    res.end();
  }
  return { props: {} };
}
