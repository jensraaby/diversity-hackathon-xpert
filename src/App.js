import React, {Component} from 'react';
import logo from './logo.svg';
import './App.css';
import {Button, ControlLabel, FormControl, FormGroup, Panel} from 'react-bootstrap';
import { TagCloud } from "react-tagcloud";
import purple from './purple.png';
import green from './green.png';

import neo4j from "neo4j-driver/lib/browser/neo4j-web";


const driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', 'password'));

const queryTag = (tag) => {
    console.log('querying ' + tag);
    const session = driver.session();

    const limit = 100;
    const queryWithGender = 'MATCH (t)<-[:Tag]-(article:NewsArticle)-[:Person]-(p)-[:Gender]-(g) WHERE t.Name = $tag RETURN article.Source, p, t, count(*), article, g.name ORDER BY count(*) LIMIT $limit';
    const query = 'MATCH (t)<-[:Tag]-(article:NewsArticle)-[:Person]-(p) WHERE t.Name = $tag RETURN article.Source, p, t, count(*), article, g ORDER BY count(*) LIMIT $limit';

    return session
        .run(queryWithGender, {tag: tag, limit: limit})
        .then(result => {
            session.close();
            return result.records;
        })
        .catch(error => {
            session.close();
            throw error;
        });
};

const queryAllTags = () => {
    const q = 'MATCH (t)<-[:Tag]-(article:NewsArticle) RETURN DISTINCT t.Name, count(*) ORDER BY count(*) DESC LIMIT 50';
    const session = driver.session();

    return session
        .run(q)
        .then(result => {
            session.close();
            return result.records;
        })
        .then(records => {
            return records.map(x => {
                const allFields = x._fields;
                const tag = allFields[0];
                const count = allFields[1].low;
                return {value: tag, count}
            })
        })
        .catch(error => {
            session.close();
            throw error;
        });
}

class TopicSelector extends Component {

    constructor(props) {
        super(props);
        this.props = props;
        this.state = {
            selectedTopic: props.tags[0]
        };
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleSelect = this.handleSelect.bind(this);
    }

    handleSubmit(event) {
        this.props.onTagSubmit(this.state.selectedTopic);
        event.preventDefault();
        event.stopPropagation();
    }

    handleSelect(event) {
        // this.props.onTagSubmit(this.state.selectedTopic);
        this.setState({selectedTopic: event.target.value});
        // event.preventDefault();
        // event.stopPropagation();
    }

    render() {
        return (
            <div>
                <Panel>
                    <Panel.Heading>
                        <Panel.Title componentClass="h3">
                            Select a news topic
                        </Panel.Title>

                    </Panel.Heading>

                    <Panel.Body>

                        <form className="form-inline" onSubmit={this.handleSubmit}>
                            <FormGroup>
                                <ControlLabel>Topic:</ControlLabel>
                                <FormControl type="select" id="queueSelector" componentClass="select"
                                             onChange={this.handleSelect}>
                                    {this.props.tags.map(tag => <option key={tag.Name}
                                                                        value={tag.Name}>{tag.Name}</option>)}
                                </FormControl>
                            </FormGroup>
                            {/*<SimpleCloud tagData={this.props.tagCloud}/>*/}

                            <Button type="submit" onClick={this.handleSubmit}>Submit</Button>
                        </form>



                    </Panel.Body>
                </Panel>

            </div>
        )
    }
}

class App extends Component {
    constructor() {
        super();
        this.state = {
            tags: [{Name: "Brexit"}, {Name: "Donald Trump"}],
            results: [],
            tagCloud: [],
            selectedTopic: null,
            personBySource: {bbc: [], aj: []}
        }
        this.topicChangeHandler = this.topicChangeHandler.bind(this);
        this.performLookup = this.performLookup.bind(this);
    }

    performLookup (tag) {
        console.log('pl ' + tag);
        return queryTag(tag)
            .then(response => {
                const names = response.map(x => {
                    const allFields = x._fields;
                    const person = allFields[1];
                    return person.properties.Name.trim();
                });

                const resultObjects = response.map(x => {
                    const allFields = x._fields;
                    const source = allFields[0];
                    const person = allFields[1];
                    const gender = allFields[5];
                    const url = allFields[4].properties.Uri;
                    // console.log(x)
                    return {name: person.properties.Name.trim(), source, url, gender};
                });

                const tagCloudData = () => {
                    const mapped = resultObjects.reduce((acc, person) => {
                        const name = person.name;
                        if (!acc[name]) {
                            acc[name] = 1;
                        }
                        else {
                            acc[name] = acc[name] + 1;
                        }
                        return acc;
                    }, {});

                    return Object.keys(mapped).map(name => ({value: name, count: mapped[name]}));
                }

                const sources = [...new Set(resultObjects.map(x => x.source))];

                // console.log(sources)
                const bbc = resultObjects.filter(x => x.source === 'BBC');
                const aj = resultObjects.filter(x => x.source !== 'BBC');

                const bbcPeople = new Set(bbc.map(x => x.name));
                const ajPeople = new Set(aj.map(x => x.name));

                const bbcUniques = new Set([...bbcPeople].filter(p => !ajPeople.has(p)));
                const ajUniques =  new Set([...ajPeople].filter(p => !bbcPeople.has(p)));

                const personBySource = {
                    bbc,
                    aj,
                    bbcUniques,
                    ajUniques
                };

                this.setState({
                    results: names,
                    tagCloud: tagCloudData(),
                    selectedTopic: tag,
                    personBySource
                })
            })
    }

    componentDidMount() {
        queryAllTags().then(results => {
            const tagNames = results.map(x => ({ Name: x.value}) )
           console.log(tagNames)
            this.setState({ tags: tagNames, tagCloudForSelector: results})
        });
        this.performLookup('Brexit');
    }

    topicChangeHandler(tag) {
        console.log('handling topic change ' + JSON.stringify(tag));
        this.performLookup(tag);
    }

    render() {
        return (
            <div className="App">
                <header className="App-header">
                    <img src={logo} className="App-logo" alt="logo"/>
                    <h1 className="App-title">Xpert</h1>
                </header>

                <TopicSelector tags={this.state.tags} tagCloud={this.state.tagCloudForSelector} onTagSubmit={this.topicChangeHandler}/>
                <div className="App-intro">
                    <h3>People associated with {this.state.selectedTopic}:</h3>

                    <table align="center">
                        <tr><th>BBC</th><th>Al Jazeera</th></tr>
                        <tr valign="top">
                            <td><NameListItems people={this.state.personBySource.bbc } uniques={this.state.personBySource.bbcUniques} /></td>
                            <td><NameListItems people={this.state.personBySource.aj } uniques={this.state.personBySource.ajUniques} /></td>
                        </tr>
                    </table>
                </div>
            </div>
        );
    }
}

const NameListItems = ({people, uniques}) => {
    const allNames = people.map(x => x.name);
    const nameCounts = () => {

        const genders = people.reduce((acc, person) => {
            const name = person.name;
            const gender = person.gender;

            if (!acc[name]) {
                acc[name] = gender;
            }
            return acc;
        }, {});

        const counts = people.reduce((acc, person) => {
            const name = person.name;
            const gender = person.gender;

            if (!acc[name]) {
                acc[name] = 1;
            }
            else {
                acc[name] = acc[name] + 1;
            }
            return acc;
        }, {});

        return Object.keys(counts).map(name => ({value: name, count: counts[name], gender: genders[name]}));
    };

    const sumOfGender = (gender) => {
        const counts = nameCounts().map(person => person.gender === gender ? person.count : 0);
        return counts.reduce((acc, count) => acc + count, 0)
    };

    const maleCounts = sumOfGender('male');
    const femaleCounts = sumOfGender('female');
    const total = maleCounts + femaleCounts;

    console.log(femaleCounts)
    console.log(maleCounts)

    const style = {
        color: "blue"
    };

    const styleForBar = {
        margin: "2px"
    };

    return <div>
        <img style={styleForBar} src={purple} width={100 * maleCounts/total} height={10} alt="male count bar" />
        <img style={styleForBar} src={green} width={100 * femaleCounts/total} height={10} alt="female count bar" />
        <ul>
        {nameCounts().map(({value, count, gender}) => {
            const commonName = !uniques.has(value);
            return <li key={value} style={commonName ? style : {}}>
                <img style={styleForBar} src={gender === 'male' ? purple : green} width={10 * count} height={10} alt="count bar" />
                {value} ({count} article(s))

            </li>
        })}
        </ul>
    </div>
};

const SimpleCloud = (data) => (
    <TagCloud minSize={12}
              maxSize={35}
              tags={data.tagData}/>
);

export default App;
