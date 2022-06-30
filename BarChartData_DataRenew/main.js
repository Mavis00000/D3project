//Load Data
d3.csv('data/movies.csv').then(
    res => {
        console.log(res);
    }
)

//Data utilities
//遇到NA就設定為undefined, 要不然就維持原本的字串
const parseNA = string => (string === 'NA' ? undefined : string);
//日期處理
const parseDate = string => d3.timeParse('%Y-%m-%d')(string);

// + 轉換成數字
function type(d) {
    const date = parseDate(d.release_date);
    return {
        budget: +d.budget, //無空值就照打,d則表示全部資料
        genre: parseNA(d.genre),
        genres: JSON.parse(d.genres).map(d => d.name),
        //JSON: 將格式改為較為正式的array顯示; map(d=>d.name): 只取name,捨棄id,避免資料雜亂
        homepage: parseNA(d.homepage),
        id: +d.id,
        imdb_id: parseNA(d.imdb_id),
        original_language: parseNA(d.original_language),
        overview: parseNA(d.overview),
        popularity: +d.popularity,
        poster_path: parseNA(d.poster_path),
        production_countries: JSON.parse(d.production_countries),
        release_date: date, //上面有處理過了
        release_year: date.getFullYear(),
        revenue: +d.revenue,
        runtime: +d.runtime,
        tagline: parseNA(d.tagline),
        title: parseNA(d.title),
        vote_average: +d.vote_average,
        vote_count: +d.vote_count,
    }
}

//Data selection
function filterData(data) {
    return data.filter(
        d => {
            return (
                d.release_year > 1999 && d.release_year < 2010 &&
                d.revenue > 0 &&
                d.budget > 0 &&
                d.genre &&
                d.title
            );
        }
    );
}

function formatTicks(d) {
    return d3.format('.2s')(d)
        .replace('M', 'mil')
        .replace('G', 'bil')
        .replace('T', 'tri')
}

function cutText(string) {
    return string.length < 35 ? string : string.substring(0, 35) + "...";
}

// budget: "42150098"
// genre: "Animation"
// genres: "[{\"id\": 16, \"name\": \"Animation\"}, {\"id\": 35, \"name\": \"Comedy\"}, {\"id\": 10751, \"name\": \"Family\"}]"
// homepage: "http://toystory.disney.com/toy-story"
// id: "862"
// imdb_id: "tt0114709"
// original_language: "en"
// overview: "Led by Woody, Andy's toys live happily in his room until Andy's birthday brings Buzz Lightyear onto the scene. Afraid of losing his place in Andy's heart, Woody plots against Buzz. But when circumstances separate Buzz and Woody from their owner, the duo eventually learns to put aside their differences."
// popularity: "21.946943"
// poster_path: "/rhIRbceoE9lR4veEXuwCC2wARtG.jpg"
// production_countries: "[{\"iso_3166_1\": \"US\", \"name\": \"United States of America\"}]"
// release_date: "1995-10-30"
// revenue: "524844632"
// runtime: "81"
// status: "Released"
// tagline: "NA"
// title: "Toy Story"
// video: "FALSE"
// vote_average: "7.7"
// vote_count: "5415"

function prepareBarChartData(data) {
    console.log(data);
    const dataMap = d3.rollup(
        data,
        v => d3.sum(v, leaf => leaf.revenue), //將revenue加總
        d => d.genre //依電影分類groupby
    );
    //debugger;
    const dataArray = Array.from(dataMap, d => ({ genre: d[0], revenue: d[1] }));
    return dataArray;
}

function setupCanvas(barChartData, moviesClean) {

    //一開始預設指標是revenue
    let metric = 'revenue';
    function click() {
        metric = this.dataset.name;
        const thisData = chooseData(metric, moviesClean);
        update(thisData);
    }

    d3.selectAll('button').on('click', click);

    function update(data) {
        console.log(data);
        //Update Scale
        xMax = d3.max(data, d => d[metric]);
        xScale_v3 = d3.scaleLinear([0, xMax], [0, chart_width]);
        yScale = d3.scaleBand().domain(data.map(d => cutText(d.title)))
            .rangeRound([0, chart_height])
            .paddingInner(0.25);
        //Transition Settings
        const defaultDelay = 1000
        const transitionDelay = d3.transition().duration(defaultDelay);
        //Update axis
        xAxisDraw.transition(transitionDelay).call(xAxis.scale(xScale_v3));
        yAxisDraw.transition(transitionDelay).call(yAxis.scale(yScale));
        //Update Header
        header.select('tspan').text(`Top 15 ${metric} movies ${metric === 'popularity' ? '' : 'in $US'}`);

        //Update Bar
        bars.selectAll('.bar').data(data, d => cutText(d.title)).join(
            enter => {
                enter.append('rect').attr('class', 'bar')
                    .attr('x', 0).attr('y', d => yScale(cutText(d.title)))
                    .attr('height', yScale.bandwidth()).style('fill', 'lightcyan')
                    .transition(transitionDelay).delay((d, i) => i * 20)
                    .attr('width', d => xScale_v3(d[metric])).style('fill', 'dodgerblue')
            },
            update => {
                update.transition(transitionDelay).delay((d, i) => i * 20).attr('y', d => yScale(cutText(d.title)))
                    .attr('width', d => xScale_v3(d[metric]))
            },
            exit => {
                exit.transition().duration(defaultDelay / 2).style('fill-opacity', 0).remove()
            });
        //interactive 新增監聽
        d3.selectAll('.bar')
            .on('mouseover', mouseover)
            .on('mousemove', mousemove)
            .on('mouseout', mouseout);
    }

    const svg_width = 700;
    const svg_height = 500;
    const chart_margin = { top: 80, right: 80, buttom: 40, left: 250 };
    const chart_width = svg_width - (chart_margin.left + chart_margin.right);
    const chart_height = svg_height - (chart_margin.top + chart_margin.buttom);
    const this_svg = d3.select('.bar-chart-container').append('svg')
        .attr('width', svg_width).attr('height', svg_height)
        .append('g')
        .attr('transform', `translate(${chart_margin.left},${chart_margin.top})`);

    //scale // d3的重頭戲~~
    //V1.d3.extent find the max & min in revenue
    const xExtent = d3.extent(barChartData, d => d.revenue);
    const xScale_v1 = d3.scaleLinear().domain(xExtent).range([0, chart_width]);

    //V2.0 ~ max
    let xMax = d3.max(barChartData, d => d.revenue); //抓出最大值
    const xScale_v2 = d3.scaleLinear().domain([0, xMax]).range([0, chart_width]);
    //V3 : Short writing for v2
    let xScale_v3 = d3.scaleLinear([0, xMax], [0, chart_width]);
    //垂直空間的分配 - 平均分布給各種類
    // const yScale = d3.scaleBand().domain(barChartData.map(d => d.genre))
    //     .rangeRound([0, chart_height]).paddingInner(0.25);

    //垂直空間的分配 - 平均分布給Top 15
    let yScale = d3.scaleBand().domain(barChartData.map(d => cutText(d.title)))
        .rangeRound([0, chart_height])
        .paddingInner(0.25);

    //出現/更新/消失
    //Draw bars
    // const bars = this_svg.selectAll('.bar')
    //     .data(barChartData)
    //     .enter()
    //     .append('rect').attr('class', 'bar')
    //     .attr('x', 0).attr('y', d => yScale(d.genre))
    //     .attr('width', d => xScale_v3(d.revenue))
    //     .attr('height', yScale.bandwidth()) //bandwidth: 除完的width
    //     .style('fill', 'dodgerblue')
    const bars = this_svg.append('g').attr('class', 'bars');

    //Draw header
    let header = this_svg.append('g').attr('class', 'bar-header')
        .attr('transform', `translate(0,${-chart_margin.top / 2})`)
        .append('text');
    // header.append('tspan').text('Total revenue by genre in $US');
    header.append('tspan').text('Top 15 XXX movies');
    header.append('tspan').text('Years:2000-2009')
        .attr('x', 0).attr('y', 20)
        .style('font-size', '0.8em')
        .style('fill', '#555');
    //tickSizeInner : the length of the tick lines
    //tickSizeOuter : the length of the square ends of the domain path
    let xAxis = d3.axisTop(xScale_v3).ticks(5).tickFormat(formatTicks)
        .tickSizeInner(-chart_height)  //裡面的線間隔
        .tickSizeOuter(0); //外面的兩端
    let xAxisDraw = this_svg.append('g').attr('class', 'x axis');
    let yAxis = d3.axisLeft(yScale).tickSize(0);
    let yAxisDraw = this_svg.append('g').attr('class', 'y axis');

    yAxisDraw.selectAll('text').attr('dx', '-0.6em');
    update(barChartData);

    //interactive 互動處理
    const tip = d3.select('.tooltip');

    function mouseover(e) {
        // debugger;
        const thisBarData = d3.select(this).data()[0];
        const bodyData = [
            ['Budget', formatTicks(thisBarData.budget)],
            ['Revenue', formatTicks(thisBarData.revenue)],
            ['Profit', formatTicks(thisBarData.revenue - thisBarData.budget)],
            ['TMDB Popularity', Math.round(thisBarData.popularity)],
            ['IMDB Rating', thisBarData.vote_average],
            ['Genres', thisBarData.genres.join(', ')]
        ];

        tip.style('left', (e.clientX + 15) + 'px')
            .style('top', e.clientY + 'px')
            .transition()
            .style('opacity', 0.98)
        // .html("Hello")
        tip.select('h3').html(`${thisBarData.title}, ${thisBarData.release_year}`);
        tip.select('h4').html(`${thisBarData.tagline}, ${thisBarData.runtime} min.`);

        d3.select('.tip-body').selectAll('p').data(bodyData)
            .join('p').attr('class', 'tip-info')
            .html(d => `${d[0]} : ${d[1]}`);
    }

    function mousemove(e) {
        tip.style('left', (e.clientX + 15) + 'px')
            .style('top', e.clientY + 'px')
        // .style('opacity', 0.98)
        // .html("Hello")
    }

    function mouseout(e) {
        tip.transition()
            .style('opacity', 0)
    }

    //interactive 新增監聽
    d3.selectAll('.bar')
        .on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseout', mouseout);


}



//Main
function ready(movies) {
    const moviesClean = filterData(movies);
    //Get Top 15 revenue movies
    const revenueData = chooseData("revenue", moviesClean);
    setupCanvas(revenueData, moviesClean);

}

function chooseData(metric, moviesClean) {
    const thisData = moviesClean.sort((a, b) => b[metric] - a[metric]).filter((d, i) => i < 15);
    return thisData;
}

d3.csv('data/movies.csv', type).then(
    res => {
        ready(res);
        // console.log(res);
    }
);