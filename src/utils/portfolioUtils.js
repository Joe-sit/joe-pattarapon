export function getRandomPortfolios(portfolios, portId) {
    const filteredPortfolios = portfolios.filter(
      (portfolio) => portfolio.id !== portId
    );
  
    filteredPortfolios.sort(() => 0.5 - Math.random());
  
    return filteredPortfolios.slice(0, 4);
  }