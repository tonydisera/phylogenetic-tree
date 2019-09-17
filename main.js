/*

Author:  Tony Di Sera tonydisera@berkeley.edu

This viz is for W209.4 Fall 2019.  Much of the D3
code came from the following sources:

  The phylogenetic tree:
  https://observablehq.com/@mbostock/tree-of-life

  The gradient legend:
  https://bl.ocks.org/john-guerra/a75733ba5767813d4f31026d1d5e6244

I've added a barchart to the radial tree that shows the
percent of sequene the species shares with the Human
genome.
*/
let tooltip = null;
let width = 730
let outerRadius = 300
let innerRadius = 180
let marginTop = 100
let marginLeft = -70
let link = null
let linkExtension = null
let node = null
let phyloFileName      = "data/hg19.100way.commonNames.nh";
let similarityFileName = "data/species_multialign_info.csv";
let speciesSimilarity = {}
let barHeight = 18
let barWidth = 5
let barPadding = 3
let barHeightIsRatio = false;
var colorScale = d3.scaleSequential()
                   .domain([0,1])
                   .interpolator(d3.interpolateYlGnBu)

$(document).ready(function() {

  var toggleButton = new ButtonStrip({
    id: 'the-toggle-button'
  });
  toggleButton.addButton('Hide', true, 'click', function(){
    update(false)
  });
  toggleButton.addButton('Show', false, 'click', function(){
    update(true)
  });
  toggleButton.append('#toggle-button');




  promiseParseTreeData()
  .then(function(treeObject) {
    drawTree(treeObject);
  })



})

function promiseParseTreeData() {
  return new Promise(function(resolve, reject) {
    let treeObject = null;
    $.get(phyloFileName, function(data) {

      treeObject = Newick.parse(data)

      d3.csv(similarityFileName)
      .then(function(similarityData) {

        parseSimilarityData(similarityData);

        resolve(treeObject);

      })
      .catch(function(error) {
        alert("Unable to load file " + similarityFileName + ".")
      })



    }, 'text');

  })

}

function parseSimilarityData(similarityData) {
  similarityData.forEach(function(rec) {
    let speciesName = rec.species.replace(/ /g, "_")
    speciesSimilarity[speciesName] = +rec.ratio_same_as_human;
  })
}


function drawTree(treeObject) {

// Define the div for the tooltip
tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  const root = d3.hierarchy(treeObject, d => d.branchset)
      .sum(d => d.branchset ? 0 : 1)
      .sort((a, b) => (a.value - b.value) || d3.ascending(a.data.length, b.data.length));



  let cluster = d3.cluster()
    .size([360, innerRadius])
    .separation((a, b) => 1)


  cluster(root);

  console.log(root)

  setRadius(root, root.data.length = 0, innerRadius / maxLength(root));

  let container = d3.select(".phylo-tree");


  let svg = container.append("svg")
             .attr("width", width )
             .attr("height", width)
             .style("font", "10px sans-serif")
             .attr("viewBox", [-outerRadius, -outerRadius, width, width]);

  drawLegend(svg);

  let group = svg.append("g")
                 .attr("transform", "translate(" + marginLeft + "," + marginTop + ")");

  linkExtension = group.append("g")
      .attr("class", "link-extensions")
      .selectAll("path")
      .data(root.links().filter(d => !d.target.children))
      .join("path")
      .each(function(d) { d.target.linkExtensionNode = this; })
      .attr("d", linkExtensionConstant);

  link = group.append("g")
      .attr("class", "links")
      .selectAll("path")
      .data(root.links())
      .join("path")
      .each(function(d) { d.target.linkNode = this; })
      .attr("d", linkConstant)


  node = group.append("g")
      .attr("class", "nodes")


  let similarity = node.selectAll("g.similarity")
      .data(root.leaves())
      .join("g")
      .attr("class", "similarity")
      .attr("transform", d => `rotate(${d.x - 90}) translate(${innerRadius + 4},0)${d.x < 180 ? "" : " rotate(180)"}`)

  similarity.append("rect")
            .attr("width", barWidth)
            .attr("height", d => {
              if (barHeightIsRatio) {
                let ratio = speciesSimilarity[d.data.name];
                if (ratio) {
                  return Math.max(barWidth, ratio * (barHeight-barPadding));
                } else {
                  return 0;
                }
              } else {
                return barHeight - barPadding;
              }
            })
            .attr("x", -barPadding)
            .attr("y", d => {
              if (barHeightIsRatio) {
                let ratio = speciesSimilarity[d.data.name];
                if (d.x >= 180) {
                  return Math.min(-barWidth, ((-barHeight+barPadding) * ratio));
                } else {
                  return 0;
                }
              } else {
                if (d.x >= 180) {
                  return -barHeight+barPadding;
                } else {
                  return 0;
                }
              }
            })
            .attr("fill", d => {
              let ratio = speciesSimilarity[d.data.name];
              return colorScale(ratio);
            })
            .on("mouseover", mouseOverRatio(true))
            .on("mouseout", mouseOverRatio(false))


  node.selectAll("text")
      .data(root.leaves())
      .join("text")
      .attr("class", function(d,i) {
        if (d.data.name == 'Human') {
          return 'emphasize-node';
        } else if (d.data.name == 'Lamprey') {
          return 'example-node';
        } else if (d.data.name == 'Elephant') {
          return 'example-node';
        } else if (d.data.name == 'Mouse') {
          return 'example-node';
        } else {
          return '';
        }
      })
      .attr("dy", ".31em")
      .attr("transform", d => `rotate(${d.x - 90}) translate(${innerRadius + barHeight + barPadding + 4},0)${d.x < 180 ? "" : " rotate(180)"}`)
      .attr("text-anchor", d => d.x < 180 ? "start" : "end")
      .text(d => {
        return d.data.name.replace(/_/g, " ")
      })
      .on("mouseover", mouseovered(true))
      .on("mouseout", mouseovered(false));

  update(false)

}

function update(checked) {
  const t = d3.transition().duration(750);
  linkExtension.transition(t).attr("d", checked ? linkExtensionVariable : linkExtensionConstant);
  link.transition(t).attr("d", checked ? linkVariable : linkConstant);
}

function drawLegend(svg) {

  legendWidth = 80;

  // Background canvas for quick drawing of 2k lines
  /*
  var canvas = d3.select('body').append("canvas")
      .attr("width", legendWidth)
      .attr("height", 20)
      .style("position", "fixed")
      .style("left", "690px")
      .style("top", "230px")

  var ctx = canvas.node().getContext("2d");
  */

  var xScale  = d3.scaleLinear().domain([0, 100]).range([0, legendWidth]);

  var axis = svg.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(-375, " + (-(width/2)+230) + ")");

  axis.call(d3.axisBottom(xScale).ticks(5));
  axis.append("text")
      .attr("class", "legend-title")
      .attr("x", 0)
      .attr("y", -27)
      .text("Percent Sequence ");
  axis.append("text")
      .attr("class", "legend-title")
      .attr("x", 0)
      .attr("y", -15)
      .text("Shared with Human");

  axis.append("image")
      .attr("xlink:href", "assets/YlGrBuGradient.png")
      .attr("x", 0)
      .attr("y", -16)
      .attr("width", legendWidth)
      .attr("height", 20);

/*
  var legendColorScale = d3.scaleSequential()
                   .domain([0,100])
                   .interpolator(d3.interpolateYlGnBu)

  var linear = d3.scaleLinear()
                .domain([0,100])
                .range([legendColorScale(0),legendColorScale(1)]);



  // Let's draw 1000 lines on canvas for speed
  d3.range(0, 100, .001)
    .forEach(function (d) {
      ctx.beginPath();
      ctx.strokeStyle = colorScale(d/100);
      ctx.moveTo(xScale(d), 0);
      ctx.lineTo(xScale(d), 20);
      ctx.stroke();
    });
  */

}

// Set the radius of each node by recursively summing and scaling the distance from the root.
function setRadius(d, y0, k) {
  d.radius = (y0 += d.data.length) * k;
  if (d.children) d.children.forEach(d => setRadius(d, y0, k));
}

function maxLength(d) {
  return d.data.length + (d.children ? d3.max(d.children, maxLength) : 0);
}
function linkVariable(d) {
  return linkStep(d.source.x, d.source.radius, d.target.x, d.target.radius);
}
function linkConstant(d) {
  return linkStep(d.source.x, d.source.y, d.target.x, d.target.y);
}
function linkExtensionVariable(d) {
  return linkStep(d.target.x, d.target.radius, d.target.x, innerRadius);
}
function linkExtensionConstant(d) {
  return linkStep(d.target.x, d.target.y, d.target.x, innerRadius);
}
function linkStep(startAngle, startRadius, endAngle, endRadius) {
  const c0 = Math.cos(startAngle = (startAngle - 90) / 180 * Math.PI);
  const s0 = Math.sin(startAngle);
  const c1 = Math.cos(endAngle = (endAngle - 90) / 180 * Math.PI);
  const s1 = Math.sin(endAngle);
  return "M" + startRadius * c0 + "," + startRadius * s0
      + (endAngle === startAngle ? "" : "A" + startRadius + "," + startRadius + " 0 0 " + (endAngle > startAngle ? 1 : 0) + " " + startRadius * c1 + "," + startRadius * s1)
      + "L" + endRadius * c1 + "," + endRadius * s1;
}
function mouseOverRatio(active) {
  return function(d) {
    if (active) {
      let ratio = speciesSimilarity[d.data.name];
      let pct = Math.round(ratio * 100,0);
      tooltip.transition()
          .duration(200)
          .style("opacity", .9);
      tooltip .html(d.data.name.replace(/_/g, " ")
                    + " shares "
                    + pct + "%  with Human")
          .style("left", (d3.event.pageX) + "px")
          .style("top", (d3.event.pageY - 44) + "px");

    } else {
      tooltip.transition()
          .duration(500)
          .style("opacity", 0);

    }
  }
}
function mouseovered(active) {
    return function(d) {

      d3.select(this).classed("label--active", active);
      d3.select(d.linkExtensionNode).classed("link-extension--active", active).raise();
      do d3.select(d.linkNode).classed("link--active", active).raise();
      while (d = d.parent);
    };
  }